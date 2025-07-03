import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useMemo } from "react";
import {
  ArrowLeftIcon,
  PencilIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PlusIcon,
  CalendarIcon,
  UserIcon,
  FolderIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks/useConfirm";
import { ProjectModal, ProjectTaskList, ProjectNoteList } from "@/components/Projects";
import TaskModal from "@/components/Tasks/TaskModal";

// 任务状态配置
const TASK_STATUS_CONFIG = {
  [TaskStatus.IDEA]: { label: "想法", color: "bg-gray-100 text-gray-800" },
  [TaskStatus.TODO]: { label: "待办", color: "bg-blue-100 text-blue-800" },
  [TaskStatus.IN_PROGRESS]: { label: "进行中", color: "bg-yellow-100 text-yellow-800" },
  [TaskStatus.WAITING]: { label: "等待中", color: "bg-purple-100 text-purple-800" },
  [TaskStatus.DONE]: { label: "已完成", color: "bg-green-100 text-green-800" },
  [TaskStatus.ARCHIVED]: { label: "已归档", color: "bg-gray-100 text-gray-800" },
};

const ProjectDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === "string" ? id : "";
  
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

  // 状态管理
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "notes">("overview");

  // 获取项目详情
  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = api.project.getById.useQuery(
    { id: projectId },
    {
      enabled: !!projectId && !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  // 获取项目统计
  const {
    data: projectStats,
    isLoading: isLoadingStats,
  } = api.project.getStats.useQuery(
    { id: projectId },
    {
      enabled: !!projectId && !!sessionData,
      staleTime: 60 * 1000,
    },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 项目操作相关的mutations
  const archiveProject = api.project.archive.useMutation({
    onSuccess: () => {
      void refetch();
      showSuccess("项目状态更新成功");
    },
    onError: (error) => {
      showError(`操作失败: ${error.message}`);
    },
  });

  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => {
      showSuccess("项目删除成功");
      void router.push("/projects");
    },
    onError: (error) => {
      showError(`删除失败: ${error.message}`);
    },
  });

  // 处理项目操作
  const handleEditProject = () => {
    setIsProjectModalOpen(true);
  };

  const handleArchiveProject = async () => {
    if (!project) return;
    
    const action = project.isArchived ? "恢复" : "归档";
    const confirmed = await showConfirm({
      title: `${action}项目`,
      message: `确定要${action}项目 "${project.name}" 吗？`,
      confirmText: action,
      type: project.isArchived ? "info" : "warning",
    });

    if (confirmed) {
      setLoading(true);
      try {
        await archiveProject.mutateAsync({
          id: project.id,
          isArchived: !project.isArchived,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    // 检查项目是否有关联内容
    const taskCount = project._count?.tasks || 0;
    const noteCount = project._count?.notes || 0;
    const hasRelatedContent = taskCount > 0 || noteCount > 0;

    let confirmMessage = `确定要删除项目 "${project.name}" 吗？此操作不可撤销。`;
    let confirmTitle = "删除项目";

    if (hasRelatedContent) {
      confirmTitle = "无法删除项目";
      confirmMessage = `项目 "${project.name}" 包含 ${taskCount} 个任务和 ${noteCount} 篇笔记。\n\n请先处理这些关联内容：\n• 删除或移动所有任务到其他项目\n• 删除或移动所有笔记到其他项目\n\n或者您可以选择归档项目作为替代方案。`;

      const action = await showConfirm({
        title: confirmTitle,
        message: confirmMessage,
        confirmText: "归档项目",
        cancelText: "取消",
        type: "warning",
      });

      if (action) {
        // 用户选择归档项目
        setLoading(true);
        try {
          await archiveProject.mutateAsync({
            id: project.id,
            isArchived: true,
          });
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    // 项目没有关联内容，可以直接删除
    const confirmed = await showConfirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmText: "删除",
      type: "danger",
    });

    if (confirmed) {
      setLoading(true);
      try {
        await deleteProject.mutateAsync({ id: project.id });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreateTask = () => {
    setIsTaskModalOpen(true);
  };

  const handleCreateNote = () => {
    void router.push(`/notes/new?projectId=${project?.id}`);
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>{project?.name || "项目详情"} | Smart GTD</title>
          <meta name="description" content="查看项目详情和管理项目内容" />
        </Head>

        <div className="space-y-6">
          {!projectId ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">项目不存在</h1>
              <Link
                href="/projects"
                className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                返回项目列表
              </Link>
            </div>
          ) : (
            <QueryLoading
              isLoading={isLoading}
              error={error}
              loadingMessage="加载项目详情中..."
              loadingComponent={<SectionLoading message="加载项目详情中..." />}
            >
            {project && (
              <>
                {/* 页面头部 */}
                <div className="mb-8">
                  {/* 导航 */}
                  <div className="mb-4">
                    <Link
                      href="/projects"
                      className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                    >
                      <ArrowLeftIcon className="mr-2 h-4 w-4" />
                      返回项目列表
                    </Link>
                  </div>

                  {/* 项目信息 */}
                  <div className="flex flex-col items-start justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
                    <div className="flex items-center space-x-4">
                      {/* 项目颜色指示器 */}
                      <div
                        className="h-12 w-12 rounded-lg border-2 border-gray-300 flex items-center justify-center"
                        style={{ backgroundColor: project.color || "#e5e7eb" }}
                      >
                        <FolderIcon className="h-6 w-6 text-white" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h1 className="text-2xl font-bold text-gray-900">
                            {project.name}
                          </h1>
                          {project.isArchived && (
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                              <ArchiveBoxIcon className="mr-1 h-4 w-4" />
                              已归档
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="mt-2 text-gray-600">{project.description}</p>
                        )}
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-1 h-4 w-4" />
                            创建于 {new Date(project.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <UserIcon className="mr-1 h-4 w-4" />
                            更新于 {new Date(project.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleCreateTask}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                      >
                        <PlusIcon className="mr-2 h-4 w-4" />
                        新建任务
                      </button>
                      <button
                        onClick={handleEditProject}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                      >
                        <PencilIcon className="mr-2 h-4 w-4" />
                        编辑
                      </button>
                      <button
                        onClick={handleArchiveProject}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                      >
                        <ArchiveBoxIcon className="mr-2 h-4 w-4" />
                        {project.isArchived ? "恢复" : "归档"}
                      </button>
                      <button
                        onClick={handleDeleteProject}
                        className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>

                {/* 统计卡片 */}
                <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ClipboardDocumentListIcon className="h-8 w-8 text-blue-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">总任务数</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {project._count?.tasks || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <DocumentTextIcon className="h-8 w-8 text-green-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">笔记数量</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {project._count?.notes || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-purple-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">完成率</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {projectStats?.completionRate ? `${Math.round(projectStats.completionRate)}%` : "0%"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="h-8 w-8 text-orange-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">活跃天数</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {projectStats?.activeDays || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 标签页导航 */}
                <div className="mb-6">
                  <nav className="flex space-x-8">
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === "overview"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      概览
                    </button>
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === "tasks"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      任务 ({project._count?.tasks || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab("notes")}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === "notes"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      笔记 ({project._count?.notes || 0})
                    </button>
                  </nav>
                </div>

                {/* 标签页内容 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">最近任务</h3>
                        {project.tasks && project.tasks.length > 0 ? (
                          <div className="space-y-3">
                            {project.tasks.slice(0, 5).map((task) => (
                              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <h4 className="text-base font-medium text-gray-900">{task.title}</h4>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${TASK_STATUS_CONFIG[task.status as TaskStatus]?.color || "bg-gray-100 text-gray-800"}`}>
                                      {TASK_STATUS_CONFIG[task.status as TaskStatus]?.label || task.status}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      创建于 {new Date(task.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <Link
                                  href={`/tasks?id=${task.id}`}
                                  className="text-blue-600 hover:text-blue-500 text-sm"
                                >
                                  查看
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">暂无任务</p>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">最近笔记</h3>
                        {project.notes && project.notes.length > 0 ? (
                          <div className="space-y-3">
                            {project.notes.slice(0, 5).map((note) => (
                              <div key={note.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <h4 className="text-base font-medium text-gray-900">{note.title}</h4>
                                  <p className="text-sm text-gray-500">
                                    更新于 {new Date(note.updatedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <Link
                                  href={`/notes/${note.id}`}
                                  className="text-blue-600 hover:text-blue-500 text-sm"
                                >
                                  查看
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">暂无笔记</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "tasks" && (
                    <ProjectTaskList
                      projectId={project.id}
                      onCreateTask={handleCreateTask}
                    />
                  )}

                  {activeTab === "notes" && (
                    <ProjectNoteList
                      projectId={project.id}
                      onCreateNote={handleCreateNote}
                    />
                  )}
                </div>

                {/* 项目模态框 */}
                <ProjectModal
                  isOpen={isProjectModalOpen}
                  onClose={() => setIsProjectModalOpen(false)}
                  projectId={project.id}
                  onSuccess={() => {
                    void refetch();
                  }}
                />

                {/* 任务模态框 */}
                <TaskModal
                  isOpen={isTaskModalOpen}
                  onClose={() => setIsTaskModalOpen(false)}
                  onSuccess={() => {
                    void refetch();
                  }}
                  defaultProjectId={project.id}
                />

                {/* 确认对话框 */}
                <ConfirmModal
                  isOpen={confirmState.isOpen}
                  onClose={hideConfirm}
                  onConfirm={confirmState.onConfirm}
                  title={confirmState.title}
                  message={confirmState.message}
                  confirmText={confirmState.confirmText}
                  cancelText={confirmState.cancelText}
                  type={confirmState.type}
                  isLoading={confirmState.isLoading}
                />
              </>
            )}
          </QueryLoading>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default ProjectDetailPage;

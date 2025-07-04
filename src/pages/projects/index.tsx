import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useMemo, useEffect } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArchiveBoxIcon,
  FolderIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  ArchiveBoxArrowDownIcon,
  InboxArrowDownIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks/useConfirm";
import { ProjectModal } from "@/components/Projects";

// 视图模式类型
type ViewMode = "grid" | "list";

// 项目卡片组件
interface ProjectCardProps {
  project: any;
  viewMode: ViewMode;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onView: () => void;
}

function ProjectCard({ project, viewMode, onEdit, onArchive, onDelete, onView }: ProjectCardProps) {
  const isArchived = project.isArchived;
  
  if (viewMode === "grid") {
    return (
      <div className="group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
        {/* 项目颜色指示器 */}
        {project.color && (
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
            style={{ backgroundColor: project.color }}
          />
        )}
        
        {/* 头部 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <FolderIcon className="h-8 w-8 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <button
                onClick={onView}
                className="text-left hover:text-blue-600 cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {project.name}
                </h3>
              </button>
              {isArchived && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                  <ArchiveBoxIcon className="mr-1 h-3 w-3" />
                  已归档
                </span>
              )}
            </div>
          </div>
          
          {/* 操作菜单 */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onEdit}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                    >
                      <PencilIcon className="mr-3 h-4 w-4" />
                      编辑项目
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onArchive}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                    >
                      {isArchived ? (
                        <>
                          <InboxArrowDownIcon className="mr-3 h-4 w-4" />
                          恢复项目
                        </>
                      ) : (
                        <>
                          <ArchiveBoxArrowDownIcon className="mr-3 h-4 w-4" />
                          归档项目
                        </>
                      )}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onDelete}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } flex w-full items-center px-4 py-2 text-sm text-red-600`}
                    >
                      <TrashIcon className="mr-3 h-4 w-4" />
                      删除项目
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
        
        {/* 描述 */}
        {project.description && (
          <p className="mt-3 text-sm text-gray-600 line-clamp-2">
            {project.description}
          </p>
        )}
        
        {/* 统计信息 */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <ClipboardDocumentListIcon className="mr-1 h-4 w-4" />
              {project._count?.tasks || 0} 任务
            </div>
            <div className="flex items-center">
              <DocumentTextIcon className="mr-1 h-4 w-4" />
              {project._count?.notes || 0} 笔记
            </div>
          </div>
          <div className="text-xs">
            {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }
  
  // 列表视图
  return (
    <div className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center space-x-4">
        {/* 项目颜色指示器 */}
        <div
          className="h-4 w-4 rounded-full border-2 border-gray-300"
          style={{ backgroundColor: project.color || "#e5e7eb" }}
        />
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={onView}
              className="text-left hover:text-blue-600 cursor-pointer"
            >
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {project.name}
              </h3>
            </button>
            {isArchived && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                <ArchiveBoxIcon className="mr-1 h-3 w-3" />
                已归档
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-1">
              {project.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-6">
        {/* 统计信息 */}
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <ClipboardDocumentListIcon className="mr-1 h-4 w-4" />
            {project._count?.tasks || 0}
          </div>
          <div className="flex items-center">
            <DocumentTextIcon className="mr-1 h-4 w-4" />
            {project._count?.notes || 0}
          </div>
          <div className="text-xs">
            {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>
        
        {/* 操作菜单 */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <EllipsisVerticalIcon className="h-5 w-5" />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onEdit}
                    className={`${
                      active ? "bg-gray-100" : ""
                    } flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                  >
                    <PencilIcon className="mr-3 h-4 w-4" />
                    编辑项目
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onArchive}
                    className={`${
                      active ? "bg-gray-100" : ""
                    } flex w-full items-center px-4 py-2 text-sm text-gray-700`}
                  >
                    {isArchived ? (
                      <>
                        <InboxArrowDownIcon className="mr-3 h-4 w-4" />
                        恢复项目
                      </>
                    ) : (
                      <>
                        <ArchiveBoxArrowDownIcon className="mr-3 h-4 w-4" />
                        归档项目
                      </>
                    )}
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onDelete}
                    className={`${
                      active ? "bg-gray-100" : ""
                    } flex w-full items-center px-4 py-2 text-sm text-red-600`}
                  >
                    <TrashIcon className="mr-3 h-4 w-4" />
                    删除项目
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </div>
  );
}

const ProjectsPage: NextPage = () => {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // 手动刷新状态

  // 查询参数
  const queryParams = useMemo(() => ({
    search: searchQuery.trim() || undefined,
    includeArchived,
    limit: 20,
  }), [searchQuery, includeArchived]);

  // 获取项目数据 - 使用无限查询支持分页
  const {
    data: projectsData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.project.getAll.useInfiniteQuery(queryParams, {
    enabled: !!sessionData,
    staleTime: 30 * 1000, // 30秒缓存
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 计算刷新状态
  const isRealInitialLoading = isLoading;
  const isDataRefreshing = isFetching && !isRealInitialLoading && isManualRefreshing;

  // 监听查询状态变化，在刷新完成后重置标志
  useEffect(() => {
    if (isManualRefreshing && !isFetching) {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, isFetching]);

  // 刷新所有数据
  const refetchAll = async () => {
    setIsManualRefreshing(true); // 标记为手动刷新
    await refetch();
  };

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetchAll();
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
      void refetch();
      showSuccess("项目删除成功");
    },
    onError: (error) => {
      showError(`删除失败: ${error.message}`);
    },
  });

  // 处理项目操作
  const handleEditProject = (projectId: string) => {
    setEditingProjectId(projectId);
    setIsProjectModalOpen(true);
  };

  const handleArchiveProject = async (project: any) => {
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

  const handleDeleteProject = async (project: any) => {
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

  const handleViewProject = (projectId: string) => {
    void router.push(`/projects/${projectId}`);
  };

  // 合并所有页面的项目数据
  const projects = useMemo(() => {
    return projectsData?.pages.flatMap(page => page.projects) ?? [];
  }, [projectsData]);

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>项目管理 | Smart GTD</title>
          <meta name="description" content="管理您的项目和工作领域" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
                {isDataRefreshing && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
              <p className="mt-2 text-gray-600">
                管理您的项目和工作领域，跟踪进度和成果
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProjectId(null);
                setIsProjectModalOpen(true);
              }}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              新建项目
            </button>
          </div>

          {/* 搜索和筛选 */}
          <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex flex-1 items-center space-x-4">
              {/* 搜索框 */}
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索项目..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 筛选选项 */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">包含已归档</span>
                </label>
              </div>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg ${
                  viewMode === "grid"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg ${
                  viewMode === "list"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 项目列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载项目列表中..."
            loadingComponent={<SectionLoading message="加载项目列表中..." />}
          >
            {projects.length > 0 ? (
              <div className="space-y-6">
                <div
                  className={`${
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                      : "space-y-4"
                  }`}
                >
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      viewMode={viewMode}
                      onEdit={() => handleEditProject(project.id)}
                      onArchive={() => handleArchiveProject(project)}
                      onDelete={() => handleDeleteProject(project)}
                      onView={() => handleViewProject(project.id)}
                    />
                  ))}
                </div>

                {/* 加载更多按钮 */}
                {hasNextPage && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isFetchingNextPage ? "加载中..." : "加载更多"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无项目</h3>
                <p className="mt-1 text-sm text-gray-500">
                  开始创建您的第一个项目来组织工作
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => {
                      setEditingProjectId(null);
                      setIsProjectModalOpen(true);
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    新建项目
                  </button>
                </div>
              </div>
            )}
          </QueryLoading>

          {/* 项目模态框 */}
          <ProjectModal
            isOpen={isProjectModalOpen}
            onClose={() => {
              setIsProjectModalOpen(false);
              setEditingProjectId(null);
            }}
            projectId={editingProjectId}
            onSuccess={() => {
              void refetch();
            }}
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
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default ProjectsPage;

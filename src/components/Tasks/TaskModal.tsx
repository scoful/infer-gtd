import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import { ButtonLoading, QueryLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagSelector } from "@/components/Tags";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  onSuccess?: () => void;
}

interface TaskFormData {
  title: string;
  description: string;
  type: TaskType;
  priority?: Priority;
  status: TaskStatus;
  dueDate?: string;
  dueTime?: string;
  projectId?: string;
  tagIds: string[];
}

const TASK_TYPES = [
  { value: TaskType.IDEA, label: "想法" },
  { value: TaskType.ACTION, label: "行动" },
];

const TASK_STATUSES = [
  { value: TaskStatus.IDEA, label: "想法" },
  { value: TaskStatus.TODO, label: "待办" },
  { value: TaskStatus.IN_PROGRESS, label: "进行中" },
  { value: TaskStatus.WAITING, label: "等待中" },
  { value: TaskStatus.DONE, label: "已完成" },
];

const PRIORITIES = [
  { value: Priority.LOW, label: "低", color: "text-gray-600" },
  { value: Priority.MEDIUM, label: "中", color: "text-blue-600" },
  { value: Priority.HIGH, label: "高", color: "text-orange-600" },
  { value: Priority.URGENT, label: "紧急", color: "text-red-600" },
];

export default function TaskModal({ isOpen, onClose, taskId, onSuccess }: TaskModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    type: TaskType.IDEA,
    status: TaskStatus.IDEA,
    tagIds: [],
  });

  const isEditing = !!taskId;
  const { showSuccess, showError } = useGlobalNotifications();

  // 获取任务详情（编辑模式）
  const {
    data: taskDetail,
    isLoading: isLoadingTask,
    error: taskError,
    isFetching: isFetchingTask,
    refetch: refetchTask
  } = api.task.getById.useQuery(
    { id: taskId! },
    {
      enabled: isEditing && isOpen,
      // 每次打开模态框时重新获取数据
      refetchOnMount: true,
      // 设置较短的 staleTime，确保数据新鲜度
      staleTime: 0,
      // 确保每次打开都会重新验证数据
      refetchOnWindowFocus: false,
      // 重试配置
      retry: 2,
    }
  );

  // 当模态框打开时，强制重新获取任务数据
  React.useEffect(() => {
    if (isOpen && isEditing && taskId) {
      // 重置表单数据，避免显示旧数据
      resetForm();
      // 强制重新获取任务数据，确保显示加载状态
      void refetchTask();
    }
  }, [isOpen, isEditing, taskId, refetchTask]);

  // 当模态框打开时，根据模式初始化表单数据
  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && taskDetail) {
        // 编辑模式：使用任务详情填充表单
        // 按照sortOrder排序标签
        const sortedTags = [...taskDetail.tags].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        setFormData({
          title: taskDetail.title,
          description: taskDetail.description || "",
          type: taskDetail.type,
          priority: taskDetail.priority || undefined,
          status: taskDetail.status,
          dueDate: taskDetail.dueDate ? taskDetail.dueDate.toISOString().split('T')[0] : undefined,
          dueTime: taskDetail.dueTime || undefined,
          projectId: taskDetail.projectId || undefined,
          tagIds: sortedTags.map(t => t.tag.id),
        });
      } else if (!isEditing) {
        // 创建模式：重置表单为默认值
        resetForm();
      }
    }
  }, [isOpen, isEditing, taskDetail]);

  // 获取项目列表
  const { data: projects, isLoading: isLoadingProjects, error: projectsError } = api.project.getAll.useQuery(
    { limit: 50 },
    { enabled: isOpen }
  );

  // 获取标签列表 - 现在已经有了标签API
  const { data: tags, isLoading: isLoadingTags } = api.tag.getAll.useQuery(
    { limit: 100 },
    { enabled: isOpen }
  );

  // 创建任务
  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      showSuccess("任务创建成功");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(`创建任务失败: ${error.message}`);
    },
  });

  // 更新任务
  const updateTask = api.task.update.useMutation({
    onSuccess: () => {
      showSuccess("任务更新成功");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(`更新任务失败: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: TaskType.IDEA,
      status: TaskStatus.IDEA,
      tagIds: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    try {
      const submitData = {
        ...formData,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        projectId: formData.projectId || undefined,
        priority: formData.priority || undefined,
      };

      if (isEditing) {
        await updateTask.mutateAsync({
          id: taskId,
          ...submitData,
        });
      } else {
        await createTask.mutateAsync(submitData);
      }
    } catch (error) {
      console.error("保存任务失败:", error);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all relative">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {isEditing ? "编辑任务" : "创建新任务"}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={handleClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* 编辑模式下的loading和错误处理 */}
                {isEditing && (isLoadingTask || isFetchingTask) ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                      <p className="mt-4 text-sm text-gray-600">
                        {isLoadingTask ? "加载任务详情中..." : "刷新任务数据中..."}
                      </p>
                    </div>
                  </div>
                ) : isEditing && taskError ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="text-red-600 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {taskError.message || "无法加载任务详情，请重试"}
                      </p>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 任务标题 */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      任务标题 *
                    </label>
                    <input
                      type="text"
                      id="title"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="输入任务标题..."
                    />
                  </div>

                  {/* 任务描述 */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      任务描述
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="输入任务描述..."
                    />
                  </div>

                  {/* 任务类型和状态 */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                        任务类型
                      </label>
                      <select
                        id="type"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as TaskType })}
                      >
                        {TASK_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                        任务状态
                      </label>
                      <select
                        id="status"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 优先级和项目 */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                        优先级
                      </label>
                      <select
                        id="priority"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={formData.priority || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          priority: e.target.value ? e.target.value as Priority : undefined
                        })}
                      >
                        <option value="">选择优先级</option>
                        {PRIORITIES.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="project" className="block text-sm font-medium text-gray-700">
                        所属项目
                      </label>
                      {isLoadingProjects ? (
                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" disabled>
                          <option>加载项目列表中...</option>
                        </select>
                      ) : projectsError ? (
                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" disabled>
                          <option>加载项目失败</option>
                        </select>
                      ) : (
                        <select
                          id="project"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          value={formData.projectId || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            projectId: e.target.value || undefined
                          })}
                        >
                          <option value="">选择项目</option>
                          {projects?.projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* 截止日期和时间 */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                        截止日期
                      </label>
                      <input
                        type="date"
                        id="dueDate"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={formData.dueDate || ""}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                      />
                    </div>

                    <div>
                      <label htmlFor="dueTime" className="block text-sm font-medium text-gray-700">
                        截止时间
                      </label>
                      <input
                        type="time"
                        id="dueTime"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={formData.dueTime || ""}
                        onChange={(e) => setFormData({ ...formData, dueTime: e.target.value || undefined })}
                      />
                    </div>
                  </div>

                  {/* 标签选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      标签
                    </label>
                    <TagSelector
                      selectedTagIds={formData.tagIds}
                      onTagsChange={(tagIds) => setFormData({ ...formData, tagIds })}
                      placeholder="选择或创建标签..."
                      allowCreate={true}
                      disabled={isLoadingTags}
                    />
                    {isLoadingTags && (
                      <p className="mt-1 text-xs text-gray-500">加载标签列表中...</p>
                    )}
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handleClose}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={createTask.isPending || updateTask.isPending}
                      className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
                    >
                      {createTask.isPending || updateTask.isPending ? (
                        <ButtonLoading message="保存中..." size="sm" />
                      ) : (
                        isEditing ? "更新" : "创建"
                      )}
                    </button>
                  </div>
                </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

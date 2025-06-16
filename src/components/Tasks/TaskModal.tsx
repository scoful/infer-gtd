import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, ClockIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

import { api } from "@/utils/api";

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

  // 获取任务详情（编辑模式）
  const { data: taskDetail } = api.task.getById.useQuery(
    { id: taskId! },
    { 
      enabled: isEditing && isOpen,
      onSuccess: (data) => {
        if (data) {
          setFormData({
            title: data.title,
            description: data.description || "",
            type: data.type,
            priority: data.priority || undefined,
            status: data.status,
            dueDate: data.dueDate ? data.dueDate.toISOString().split('T')[0] : undefined,
            dueTime: data.dueTime || undefined,
            projectId: data.projectId || undefined,
            tagIds: data.tags.map(t => t.tag.id),
          });
        }
      },
    }
  );

  // 获取项目列表
  const { data: projects } = api.project.getAll.useQuery(
    { limit: 50 },
    { enabled: isOpen }
  );

  // 获取标签列表
  // 注意：这里需要一个获取标签的API，暂时注释掉
  // const { data: tags } = api.tag.getAll.useQuery(
  //   { limit: 50 },
  //   { enabled: isOpen }
  // );

  // 创建任务
  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
      resetForm();
    },
  });

  // 更新任务
  const updateTask = api.task.update.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
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
    if (!isEditing) {
      resetForm();
    }
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
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
                    </div>
                  </div>

                  {/* 截止日期和时间 */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                        截止日期
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="date"
                          id="dueDate"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          value={formData.dueDate || ""}
                          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                        />
                        <CalendarIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="dueTime" className="block text-sm font-medium text-gray-700">
                        截止时间
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="time"
                          id="dueTime"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          value={formData.dueTime || ""}
                          onChange={(e) => setFormData({ ...formData, dueTime: e.target.value || undefined })}
                        />
                        <ClockIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
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
                      className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {createTask.isPending || updateTask.isPending ? "保存中..." : (isEditing ? "更新" : "创建")}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

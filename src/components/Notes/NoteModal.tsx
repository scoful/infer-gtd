import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { MarkdownEditor } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagSelector } from "@/components/Tags";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string;
  onSuccess?: () => void;
}

interface NoteFormData {
  title: string;
  content: string;
  projectId?: string;
  tagIds: string[];
  linkedTaskIds: string[];
}

export default function NoteModal({
  isOpen,
  onClose,
  noteId,
  onSuccess,
}: NoteModalProps) {
  const [formData, setFormData] = useState<NoteFormData>({
    title: "",
    content: "",
    tagIds: [],
    linkedTaskIds: [],
  });

  const isEditing = !!noteId;
  const { showSuccess, showError } = useGlobalNotifications();

  // 获取笔记详情（编辑模式）
  const {
    data: noteDetail,
    isLoading: isLoadingNote,
    error: noteError,
  } = api.note.getById.useQuery(
    { id: noteId! },
    {
      enabled: isEditing && isOpen,
      refetchOnMount: true,
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  );

  // 获取项目列表
  const { data: projectsData } = api.project.getAll.useQuery(
    { limit: 100 },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 获取任务列表（用于关联）
  const { data: tasksData } = api.task.getAll.useQuery(
    { limit: 100 },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 创建笔记
  const createNote = api.note.create.useMutation({
    onSuccess: (result) => {
      showSuccess(`笔记 "${result.title}" 创建成功`);
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(error.message ?? "创建笔记失败");
    },
  });

  // 更新笔记
  const updateNote = api.note.update.useMutation({
    onSuccess: (result) => {
      showSuccess(`笔记 "${result.title}" 更新成功`);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error.message ?? "更新笔记失败");
    },
  });

  // 当模态框打开时，根据模式初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (isEditing && noteDetail) {
        // 编辑模式：使用笔记详情填充表单
        setFormData({
          title: noteDetail.title,
          content: noteDetail.content,
          projectId: noteDetail.projectId ?? undefined,
          tagIds: noteDetail.tags.map((t) => t.tag.id),
          linkedTaskIds: noteDetail.linkedTasks.map((t) => t.id),
        });
      } else if (!isEditing) {
        // 创建模式：重置表单为默认值
        resetForm();
      }
    }
  }, [isOpen, isEditing, noteDetail]);

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      tagIds: [],
      linkedTaskIds: [],
    });
  };

  const handleClose = () => {
    onClose();
    if (!isEditing) {
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      showError("标题和内容不能为空");
      return;
    }

    try {
      const submitData = {
        ...formData,
        projectId: formData.projectId || undefined,
      };

      if (isEditing) {
        await updateNote.mutateAsync({
          id: noteId,
          ...submitData,
        });
      } else {
        await createNote.mutateAsync(submitData);
      }
    } catch (error) {
      console.error("保存笔记失败:", error);
    }
  };

  const isSubmitting = createNote.isPending || updateNote.isPending;

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
          <div className="bg-opacity-25 fixed inset-0 bg-black" />
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900"
                  >
                    {isEditing ? "编辑笔记" : "新建笔记"}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onClick={handleClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* 加载状态 */}
                {isEditing && isLoadingNote ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">
                      加载笔记详情中...
                    </span>
                  </div>
                ) : noteError ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <svg
                        className="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-medium text-gray-900">
                      加载失败
                    </h3>
                    <p className="mb-4 text-sm text-gray-600">
                      {noteError.message ?? "无法加载笔记详情，请重试"}
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      关闭
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 笔记标题 */}
                    <div>
                      <label
                        htmlFor="title"
                        className="block text-sm font-medium text-gray-700"
                      >
                        笔记标题 *
                      </label>
                      <input
                        type="text"
                        id="title"
                        required
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="输入笔记标题..."
                      />
                    </div>

                    {/* 笔记内容 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        笔记内容 *
                      </label>
                      <MarkdownEditor
                        value={formData.content}
                        onChange={(content) =>
                          setFormData({ ...formData, content })
                        }
                        placeholder="开始编写你的笔记内容..."
                        height={350}
                        preview="live"
                      />
                    </div>

                    {/* 项目选择 */}
                    <div>
                      <label
                        htmlFor="project"
                        className="block text-sm font-medium text-gray-700"
                      >
                        关联项目
                      </label>
                      <select
                        id="project"
                        value={formData.projectId || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            projectId: e.target.value || undefined,
                          })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">选择项目（可选）</option>
                        {projectsData?.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 标签选择 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        标签
                      </label>
                      <TagSelector
                        selectedTagIds={formData.tagIds}
                        onTagsChange={(tagIds: string[]) =>
                          setFormData({ ...formData, tagIds })
                        }
                        maxTags={10}
                      />
                    </div>

                    {/* 关联任务 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        关联任务
                      </label>
                      <div className="max-h-32 overflow-y-auto rounded-md border border-gray-300 p-2">
                        {tasksData?.tasks && tasksData.tasks.length > 0 ? (
                          tasksData.tasks.map((task) => (
                            <label
                              key={task.id}
                              className="flex items-center py-1"
                            >
                              <input
                                type="checkbox"
                                checked={formData.linkedTaskIds.includes(
                                  task.id,
                                )}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      linkedTaskIds: [
                                        ...formData.linkedTaskIds,
                                        task.id,
                                      ],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      linkedTaskIds:
                                        formData.linkedTaskIds.filter(
                                          (id) => id !== task.id,
                                        ),
                                    });
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {task.title}
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">
                            暂无任务可关联
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-3 pt-6">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center">
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            {isEditing ? "更新中..." : "创建中..."}
                          </div>
                        ) : isEditing ? (
                          "更新笔记"
                        ) : (
                          "创建笔记"
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

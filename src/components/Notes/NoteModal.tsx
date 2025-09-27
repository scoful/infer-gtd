import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { ToastUIEditor } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagSelector } from "@/components/Tags";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string; // 现在是必需的，因为只用于编辑
  onSuccess?: () => void;
}

interface NoteFormData {
  title: string;
  content: string;
  summary?: string;
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
    summary: "",
    tagIds: [],
    linkedTaskIds: [],
  });

  // 现在只支持编辑模式
  const isEditing = true;
  const { showSuccess, showError } = useGlobalNotifications();

  // 添加状态来跟踪编辑器是否处于全屏模式
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);

  // 获取笔记详情（编辑模式）
  const {
    data: noteDetail,
    isLoading: isLoadingNote,
    error: noteError,
  } = api.note.getById.useQuery(
    { id: noteId },
    {
      enabled: isOpen, // noteId现在总是存在
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

  // 获取标签列表
  const { isLoading: isLoadingTags } = api.tag.getAll.useQuery(
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

  // 更新笔记（手动提交）
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

  // 自动保存笔记（不关闭模态框）
  const autoSaveNote = api.note.update.useMutation({
    onSuccess: () => {
      // 自动保存成功，不显示通知，不关闭模态框
    },
    onError: () => {
      // 自动保存失败也不显示错误通知，避免打扰用户
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
          summary: noteDetail.summary ?? "",
          projectId: noteDetail.projectId ?? undefined,
          tagIds: noteDetail.tags.map((t) => t.tag.id),
          linkedTaskIds: noteDetail.linkedTasks.map((t) => t.id),
        });
      } else if (!isEditing) {
        // 创建模式：重置表单为默认值
        resetForm();
      }
    } else {
      // 模态框关闭时，确保清理全屏相关的样式
      setIsEditorFullscreen(false);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.classList.remove("w-md-editor-fullscreen");
      document.documentElement.classList.remove("w-md-editor-fullscreen");
    }
  }, [isOpen, isEditing, noteDetail]);

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      summary: "",
      tagIds: [],
      linkedTaskIds: [],
    });
  };

  // 监听全屏状态变化和点击事件
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setIsEditorFullscreen(isFullscreen);

      // 如果退出全屏，确保恢复页面滚动
      if (!isFullscreen) {
        // 延迟执行，确保全屏退出动画完成
        setTimeout(() => {
          document.body.style.overflow = "";
          document.documentElement.style.overflow = "";
          document.body.classList.remove("w-md-editor-fullscreen");
          document.documentElement.classList.remove("w-md-editor-fullscreen");
        }, 100);
      }
    };

    // 阻止全屏模式下的点击事件冒泡到 Dialog
    const handleDocumentClick = (event: MouseEvent) => {
      if (isEditorFullscreen) {
        // 检查点击是否来自编辑器外部
        const target = event.target as Element;
        const editorElement = document.querySelector(".w-md-editor-fullscreen");

        if (editorElement && !editorElement.contains(target)) {
          // 阻止事件冒泡，防止触发 Dialog 的关闭
          event.stopPropagation();
          event.preventDefault();
        }
      }
    };

    // 处理全屏模式下的键盘事件
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditorFullscreen) {
        // ESC 键：让编辑器处理，不要关闭模态框
        if (event.key === "Escape") {
          event.stopPropagation();
        }
        // Ctrl+Enter 已由 ToastUIEditor 统一处理，这里不再重复处理
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    document.addEventListener("click", handleDocumentClick, true); // 使用捕获阶段
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isEditorFullscreen]);

  const handleClose = () => {
    // 如果编辑器处于全屏模式，不允许关闭模态框
    if (isEditorFullscreen) {
      console.log("阻止模态框关闭：编辑器处于全屏模式");
      return;
    }

    // 确保清理任何残留的样式
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.body.classList.remove("w-md-editor-fullscreen");
    document.documentElement.classList.remove("w-md-editor-fullscreen");

    onClose();
    if (!isEditing) {
      resetForm();
    }
  };

  // 创建一个更安全的关闭处理函数
  const safeHandleClose = useCallback(() => {
    // 双重检查全屏状态
    const isCurrentlyFullscreen =
      !!document.fullscreenElement ||
      document.body.classList.contains("w-md-editor-fullscreen") ||
      !!document.querySelector(".w-md-editor-fullscreen");

    if (isCurrentlyFullscreen) {
      console.log("阻止模态框关闭：检测到全屏状态");
      return;
    }

    handleClose();
  }, [isEditorFullscreen]);

  // 处理提交
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // 防止重复提交
      if (updateNote.isPending) {
        return;
      }

      if (!formData.title.trim() || !formData.content.trim()) {
        showError("标题和内容不能为空");
        return;
      }

      try {
        const submitData = {
          ...formData,
          projectId: formData.projectId ?? undefined,
        };

        // 现在只支持编辑模式
        await updateNote.mutateAsync({
          id: noteId,
          ...submitData,
        });
      } catch (error) {
        // 错误已由mutation的onError处理
      }
    },
    [formData, noteId, updateNote, showError],
  );

  // Ctrl+Enter 快捷键已由 ToastUIEditor 统一处理，通过 onCtrlEnterSave 回调触发

  const isSubmitting = updateNote.isPending;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={safeHandleClose}
        static={isEditorFullscreen}
      >
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
              <Dialog.Panel className="w-full max-w-4xl transform rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900"
                  >
                    编辑笔记
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

                    {/* 笔记摘要 */}
                    <div>
                      <label
                        htmlFor="summary"
                        className="block text-sm font-medium text-gray-700"
                      >
                        笔记摘要
                      </label>
                      <textarea
                        id="summary"
                        rows={3}
                        value={formData.summary}
                        onChange={(e) =>
                          setFormData({ ...formData, summary: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="输入笔记摘要，用于在列表中预览（可选）..."
                        maxLength={300}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        摘要将在笔记列表中显示，帮助快速了解笔记内容（最多300字符）
                      </p>
                    </div>

                    {/* 笔记内容 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        笔记内容 *
                      </label>
                      <ToastUIEditor
                        value={formData.content}
                        onChange={(content) =>
                          setFormData({ ...formData, content })
                        }
                        placeholder="开始编写你的笔记内容..."
                        height="350px"
                        enableJetBrainsShortcuts={true}
                        autoSave={true}
                        autoSaveType="server"
                        autoSaveStatus={
                          autoSaveNote.isPending
                            ? "saving"
                            : autoSaveNote.isSuccess
                              ? "saved"
                              : "unsaved"
                        }
                        onAutoSave={(content) => {
                          // 自动保存到服务器
                          if (!content.trim() || !noteId) return;

                          const saveData = {
                            title: formData.title.trim() || "无标题笔记",
                            content: content,
                            summary: formData.summary?.trim() || undefined,
                            projectId: formData.projectId || undefined,
                            tagIds: formData.tagIds,
                          };

                          autoSaveNote.mutate({
                            id: noteId,
                            ...saveData,
                          });
                        }}
                        onCtrlEnterSave={(currentContent) => {
                          // Ctrl+Enter 快捷键保存，直接使用编辑器当前内容
                          const titleInput = document.getElementById("title") as HTMLInputElement;
                          const currentTitle = titleInput?.value?.trim() || formData.title.trim();

                          if (!currentTitle || !currentContent?.trim()) {
                            showError("标题和内容不能为空");
                            return;
                          }

                          if (updateNote.isPending) {
                            return;
                          }

                          const submitData = {
                            ...formData,
                            title: currentTitle,
                            content: currentContent,
                            projectId: formData.projectId ?? undefined,
                          };

                          void updateNote.mutateAsync({
                            id: noteId,
                            ...submitData,
                          });
                        }}
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
                        value={formData.projectId ?? ""}
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
                        placeholder="选择或创建标签..."
                        allowCreate={true}
                        disabled={isLoadingTags}
                        sortable={true}
                        maxTags={10}
                      />
                      {isLoadingTags && (
                        <p className="mt-1 text-xs text-gray-500">
                          加载标签列表中...
                        </p>
                      )}
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

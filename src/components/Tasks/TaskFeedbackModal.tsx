import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { ButtonLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagSelector } from "@/components/Tags";

interface TaskFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onSuccess?: () => void;
}

interface FeedbackFormData {
  feedback: string;
  tagIds: string[];
}

export default function TaskFeedbackModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onSuccess,
}: TaskFeedbackModalProps) {
  const [formData, setFormData] = useState<FeedbackFormData>({
    feedback: "",
    tagIds: [],
  });

  const { showSuccess, showError } = useGlobalNotifications();

  // 当taskId变化时重置表单
  useEffect(() => {
    if (isOpen && taskId) {
      setFormData({
        feedback: "",
        tagIds: [],
      });
    }
  }, [taskId, isOpen]);

  // 获取标签列表
  const { isLoading: isLoadingTags } = api.tag.getAll.useQuery(
    { limit: 100 },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 获取任务详情（包含反馈和标签信息）
  const {
    data: taskDetail,
    isLoading: isLoadingTask,
    error: taskError,
  } = api.task.getById.useQuery(
    { id: taskId },
    {
      enabled: isOpen && !!taskId,
      retry: 1, // 只重试一次
      refetchOnMount: true, // 每次挂载时重新获取
      refetchOnWindowFocus: false, // 避免窗口聚焦时重新获取
      staleTime: 0, // 立即过期，确保获取最新数据
    },
  );

  // 当获取到任务数据时更新表单
  useEffect(() => {
    if (taskDetail) {
      setFormData({
        feedback: taskDetail.feedback ?? "",
        tagIds: taskDetail.tags.map((t) => t.tag.id),
      });
    } else if (taskError) {
      console.warn("获取任务详情失败，使用默认值:", taskError.message);
      setFormData({
        feedback: "",
        tagIds: [],
      });
    }
  }, [taskDetail, taskError]);

  // 更新任务（包含反馈和标签）
  const updateTask = api.task.update.useMutation({
    onSuccess: (result) => {
      showSuccess(`任务 "${result.title}" 反馈和标签已保存`);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error.message ?? "保存失败");
    },
  });

  // 处理关闭
  const handleClose = () => {
    onClose();
  };

  // 处理提交
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      updateTask.mutate({
        id: taskId,
        feedback: formData.feedback,
        tagIds: formData.tagIds,
      });
    },
    [taskId, formData.feedback, formData.tagIds, updateTask],
  );

  // 添加 Ctrl+Enter 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        // 检查是否不在提交中
        if (!updateTask.isPending) {
          // 创建一个模拟的表单事件
          const mockEvent = {
            preventDefault: () => {},
          } as React.FormEvent;
          handleSubmit(mockEvent);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updateTask.isPending, handleSubmit]);

  // 处理标签变化
  const handleTagsChange = (newTagIds: string[]) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: newTagIds,
    }));
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* 标题栏 */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg leading-6 font-medium text-gray-900"
                    >
                      任务完成反馈
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-600">{taskTitle}</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-md p-2 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {isLoadingTask && !taskError ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <span className="ml-2 text-gray-600">加载中...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 任务反馈 */}
                    <div>
                      <label
                        htmlFor="feedback"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        任务反馈
                      </label>
                      <textarea
                        id="feedback"
                        rows={4}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="完成这个任务后，有什么想记录的反馈吗？"
                        value={formData.feedback}
                        onChange={(e) =>
                          setFormData({ ...formData, feedback: e.target.value })
                        }
                      />
                    </div>

                    {/* 标签选择 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        任务标签
                      </label>
                      <TagSelector
                        selectedTagIds={formData.tagIds}
                        onTagsChange={handleTagsChange}
                        placeholder="选择或创建标签..."
                        allowCreate={true}
                        disabled={isLoadingTags}
                        size="md"
                        gridLayout={true}
                        closeOnSelect={false}
                        sortable={true}
                      />
                      {isLoadingTags && (
                        <p className="mt-1 text-xs text-gray-500">
                          加载标签列表中...
                        </p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      >
                        跳过
                      </button>
                      <button
                        type="submit"
                        disabled={updateTask.isPending}
                        className="flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                      >
                        {updateTask.isPending ? (
                          <ButtonLoading message="保存中..." size="sm" />
                        ) : (
                          "保存反馈"
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

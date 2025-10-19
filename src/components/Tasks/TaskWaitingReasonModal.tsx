import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { TaskStatus } from "@prisma/client";

import { api } from "@/utils/api";
import { ButtonLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface TaskWaitingReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onSuccess?: () => void;
}

interface WaitingReasonFormData {
  waitingReason: string;
}

export default function TaskWaitingReasonModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onSuccess,
}: TaskWaitingReasonModalProps) {
  const [formData, setFormData] = useState<WaitingReasonFormData>({
    waitingReason: "",
  });

  const { showSuccess, showError } = useGlobalNotifications();

  // 当taskId变化时重置表单
  useEffect(() => {
    if (isOpen && taskId) {
      setFormData({
        waitingReason: "",
      });
    }
  }, [taskId, isOpen]);

  // 获取任务详情（包含等待原因信息）
  const {
    data: taskDetail,
    isLoading: isLoadingTask,
    error: taskError,
  } = api.task.getById.useQuery(
    { id: taskId },
    {
      enabled: isOpen && !!taskId,
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  );

  // 当获取到任务数据时更新表单
  useEffect(() => {
    if (taskDetail) {
      setFormData({
        waitingReason: taskDetail.waitingReason ?? "",
      });
    } else if (taskError) {
      console.warn("获取任务详情失败，使用默认值:", taskError.message);
      setFormData({
        waitingReason: "",
      });
    }
  }, [taskDetail, taskError]);

  // 更新任务（包含等待原因） - v10使用useContext
  const utils = api.useContext();

  const updateTask = api.task.update.useMutation({
    onSuccess: (result) => {
      showSuccess(`任务 "${result.title}" 等待原因已保存`);

      // 刷新相关查询缓存
      void utils.task.getAll.invalidate();
      void utils.task.getByStatus.invalidate();
      void utils.task.getById.invalidate({ id: result.id });

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

      if (!taskId) {
        showError("任务ID无效");
        return;
      }

      if (!formData.waitingReason.trim()) {
        showError("请填写等待原因");
        return;
      }

      updateTask.mutate({
        id: taskId,
        status: TaskStatus.WAITING,
        waitingReason: formData.waitingReason.trim(),
      });
    },
    [taskId, formData.waitingReason, updateTask, showError],
  );

  // 添加 Ctrl+Enter 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        // 检查表单是否有效且不在提交中
        if (formData.waitingReason.trim() && !updateTask.isPending) {
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
  }, [isOpen, formData.waitingReason, updateTask.isPending, handleSubmit]);

  // 处理输入变化
  const handleInputChange = (
    field: keyof WaitingReasonFormData,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    等待原因
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleClose}
                  >
                    <span className="sr-only">关闭</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    任务{" "}
                    <span className="font-medium text-gray-900">
                      "{taskTitle}"
                    </span>{" "}
                    已移动到等待中状态。 请说明等待的原因，以便后续跟进。
                  </p>
                </div>

                {isLoadingTask ? (
                  <div className="mt-4 flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-500">
                      加载任务信息...
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {/* 等待原因输入 */}
                    <div>
                      <label
                        htmlFor="waitingReason"
                        className="block text-sm font-medium text-gray-700"
                      >
                        等待原因 <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="waitingReason"
                          name="waitingReason"
                          rows={4}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="请描述任务等待的具体原因，例如：等待他人回复、等待资源到位、等待审批等..."
                          value={formData.waitingReason}
                          onChange={(e) =>
                            handleInputChange("waitingReason", e.target.value)
                          }
                          required
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        详细的等待原因有助于后续跟进和处理。按 Ctrl+Enter
                        快速保存
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        onClick={handleClose}
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={updateTask.isPending}
                        className="flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {updateTask.isPending ? (
                          <ButtonLoading message="保存中..." size="sm" />
                        ) : (
                          "保存原因"
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

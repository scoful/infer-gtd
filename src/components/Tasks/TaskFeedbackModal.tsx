import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import { api } from "@/utils/api";
import { ButtonLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface TaskFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onSuccess?: () => void;
}

interface FeedbackFormData {
  reflection: string;
  lessons: string;
  feedback: string;
  rating: number;
}

export default function TaskFeedbackModal({ 
  isOpen, 
  onClose, 
  taskId, 
  taskTitle, 
  onSuccess 
}: TaskFeedbackModalProps) {
  const [formData, setFormData] = useState<FeedbackFormData>({
    reflection: "",
    lessons: "",
    feedback: "",
    rating: 0,
  });

  const { showSuccess, showError } = useGlobalNotifications();

  // 获取现有反馈数据
  const { data: existingFeedback, isLoading: isLoadingFeedback, error: feedbackError } = api.task.getFeedback.useQuery(
    { id: taskId },
    {
      enabled: isOpen && !!taskId,
      retry: 1, // 只重试一次
      onSuccess: (data) => {
        if (data) {
          setFormData({
            reflection: data.reflection || "",
            lessons: data.lessons || "",
            feedback: data.feedback || "",
            rating: data.rating || 0,
          });
        }
      },
      onError: (error) => {
        console.warn("获取任务反馈失败，使用默认值:", error.message);
        // 如果获取失败，使用默认值，不阻止用户填写反馈
        setFormData({
          reflection: "",
          lessons: "",
          feedback: "",
          rating: 0,
        });
      }
    }
  );

  // 保存反馈
  const updateFeedback = api.task.updateFeedback.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error.message || "保存反馈失败");
    },
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      reflection: "",
      lessons: "",
      feedback: "",
      rating: 0,
    });
  };

  // 处理关闭
  const handleClose = () => {
    onClose();
  };

  // 处理提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateFeedback.mutate({
      id: taskId,
      ...formData,
      rating: formData.rating > 0 ? formData.rating : undefined,
    });
  };

  // 处理评分点击
  const handleRatingClick = (rating: number) => {
    setFormData(prev => ({ ...prev, rating }));
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
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      任务完成反馈
                    </Dialog.Title>
                    <p className="text-sm text-gray-600 mt-1">
                      {taskTitle}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-md p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {isLoadingFeedback && !feedbackError ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="ml-2 text-gray-600">加载中...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 任务评分 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        任务评分
                      </label>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleRatingClick(star)}
                            className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {star <= formData.rating ? (
                              <StarIconSolid className="h-6 w-6 text-yellow-400" />
                            ) : (
                              <StarIcon className="h-6 w-6 text-gray-300" />
                            )}
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-gray-600">
                          {formData.rating > 0 ? `${formData.rating} 星` : "未评分"}
                        </span>
                      </div>
                    </div>

                    {/* 心得反思 */}
                    <div>
                      <label htmlFor="reflection" className="block text-sm font-medium text-gray-700 mb-2">
                        心得反思
                      </label>
                      <textarea
                        id="reflection"
                        rows={4}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="完成这个任务后，你有什么心得体会？学到了什么？"
                        value={formData.reflection}
                        onChange={(e) => setFormData({ ...formData, reflection: e.target.value })}
                      />
                    </div>

                    {/* 经验教训 */}
                    <div>
                      <label htmlFor="lessons" className="block text-sm font-medium text-gray-700 mb-2">
                        经验教训
                      </label>
                      <textarea
                        id="lessons"
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="遇到了什么困难？下次如何改进？有什么经验可以分享？"
                        value={formData.lessons}
                        onChange={(e) => setFormData({ ...formData, lessons: e.target.value })}
                      />
                    </div>

                    {/* 其他反馈 */}
                    <div>
                      <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                        其他反馈
                      </label>
                      <textarea
                        id="feedback"
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="还有其他想记录的内容吗？"
                        value={formData.feedback}
                        onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                      />
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        跳过
                      </button>
                      <button
                        type="submit"
                        disabled={updateFeedback.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
                      >
                        {updateFeedback.isPending ? (
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

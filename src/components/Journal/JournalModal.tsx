import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, BookOpenIcon, CalendarIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { MarkdownEditor } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface JournalFormData {
  content: string;
  template?: string;
}

export default function JournalModal({
  isOpen,
  onClose,
  onSuccess,
}: JournalModalProps) {
  const [formData, setFormData] = useState<JournalFormData>({
    content: "",
    template: undefined,
  });

  const { showSuccess, showError } = useGlobalNotifications();
  const today = new Date();

  // 检查今天是否已有日记
  const { data: existingJournal } = api.journal.getByDate.useQuery(
    { date: today },
    {
      enabled: isOpen,
    }
  );

  // 创建日记
  const createJournal = api.journal.upsert.useMutation({
    onSuccess: (result) => {
      showSuccess("日记创建成功");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(error.message ?? "创建失败");
    },
  });

  // 当模态框打开时初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (existingJournal) {
        // 如果今天已有日记，填充现有内容
        setFormData({
          content: existingJournal.content,
          template: existingJournal.template || undefined,
        });
      } else {
        // 如果今天没有日记，重置表单
        resetForm();
      }
    }
  }, [isOpen, existingJournal]);

  const resetForm = () => {
    setFormData({
      content: "",
      template: undefined,
    });
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      showError("请输入日记内容");
      return;
    }

    const saveData = {
      date: today,
      content: formData.content,
      template: formData.template,
    };

    createJournal.mutate(saveData);
  };

  // 应用模板
  const applyTemplate = (templateContent: string) => {
    setFormData({ ...formData, content: templateContent });
  };

  // 默认模板
  const defaultTemplate = `# ${today.toLocaleDateString("zh-CN")} 日记

## 今日完成
- 

## 今日学习
- 

## 心得感悟
- 

## 遇到的问题
- 

## 明日计划
- `;

  const isSubmitting = createJournal.isPending;

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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                  <div className="flex items-center space-x-3">
                    <BookOpenIcon className="h-6 w-6 text-blue-600" />
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900"
                      >
                        {existingJournal ? "编辑今日日记" : "新建今日日记"}
                      </Dialog.Title>
                      <div className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="mr-1 h-4 w-4" />
                        {today.toLocaleDateString("zh-CN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={handleClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6">
                  <div className="space-y-4">
                    {/* 工具栏 */}
                    {!existingJournal && formData.content.trim() === "" && (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => applyTemplate(defaultTemplate)}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <BookOpenIcon className="mr-1 h-4 w-4" />
                          使用模板
                        </button>
                      </div>
                    )}

                    {/* 日记内容 */}
                    <div>
                      <MarkdownEditor
                        value={formData.content}
                        onChange={(content) =>
                          setFormData({ ...formData, content })
                        }
                        placeholder="开始写今天的日记..."
                        height={400}
                        preview="live"
                        enableJetBrainsShortcuts={true}
                        autoSave={false}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={handleClose}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.content.trim()}
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                          保存中...
                        </>
                      ) : (
                        <>
                          <BookOpenIcon className="mr-2 h-4 w-4" />
                          {existingJournal ? "更新日记" : "保存日记"}
                        </>
                      )}
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

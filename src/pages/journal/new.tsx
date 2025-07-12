import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { MarkdownEditor } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface JournalFormData {
  content: string;
  template?: string;
}

const NewJournalPage: NextPage = () => {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();

  const [formData, setFormData] = useState<JournalFormData>({
    content: "",
    template: undefined,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 从URL参数获取日期，如果没有则使用今天
  const targetDate = useMemo(() => {
    const dateParam = router.query.date as string;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const date = new Date(dateParam + 'T00:00:00');
      return date;
    }

    const date = new Date();
    // 重置时间为当天的开始，确保日期比较的一致性
    date.setHours(0, 0, 0, 0);
    return date;
  }, [router.query.date]);

  // 检查目标日期是否已有日记
  const { data: existingJournal } = api.journal.getByDate.useQuery(
    { date: targetDate },
    {
      enabled: !!sessionData && router.isReady,
    },
  );

  // 如果目标日期已有日记，重定向到编辑页面
  useEffect(() => {
    if (existingJournal) {
      void router.replace(`/journal/${existingJournal.id}`);
    }
  }, [existingJournal, router]);

  // 恢复本地草稿
  useEffect(() => {
    const draftKey = "journal-draft-new";
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Partial<JournalFormData>;
        setFormData((prev) => ({
          ...prev,
          ...draft,
        }));
      } catch (error) {
        console.error("恢复草稿失败，清除无效草稿:", error);
        localStorage.removeItem(draftKey);
      }
    }
  }, []);

  // 创建日记
  const createJournal = api.journal.upsert.useMutation({
    onSuccess: (result) => {
      showSuccess("日记创建成功");
      // 清除草稿
      localStorage.removeItem("journal-draft-new");
      setIsSubmitting(false);

      // 检查来源页面，决定跳转目标
      const from = router.query.from as string;
      if (from === "list") {
        // 如果来自日记列表，返回列表页面
        void router.push("/journal/list");
      } else if (from === "index") {
        // 如果来自日记首页，返回日记首页
        void router.push("/journal");
      } else if (from === "home") {
        // 如果来自首页，返回首页
        void router.push("/");
      } else {
        // 否则跳转到日记详情页面
        void router.push(`/journal/${result.id}`);
      }
    },
    onError: (error) => {
      showError(error.message ?? "创建失败");
      setIsSubmitting(false);
    },
  });

  // 最终提交（创建日记）
  const finalSubmit = () => {
    const saveData = {
      date: targetDate,
      content: formData.content,
      template: formData.template,
    };

    createJournal.mutate(saveData);
  };

  // 处理返回
  const handleBack = () => {
    const from = router.query.from as string;
    if (from === "list") {
      // 如果来自日记列表，返回列表页面
      void router.push("/journal/list");
    } else if (from === "index") {
      // 如果来自日记首页，返回日记首页
      void router.push("/journal");
    } else if (from === "home") {
      // 如果来自首页，返回首页
      void router.push("/");
    } else {
      // 默认返回日记首页
      void router.push("/journal");
    }
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      showError("请输入日记内容");
      return;
    }

    setIsSubmitting(true);
    finalSubmit();
  };

  // 处理自动保存（本地草稿保存）
  const handleAutoSave = (content: string) => {
    // 准备保存数据
    const draftData = {
      content: content,
      template: formData.template,
    };

    // 保存到本地存储
    const draftKey = "journal-draft-new";
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch (error) {
      console.error("保存草稿失败:", error);
    }
  };

  // 应用模板
  const applyTemplate = (templateContent: string) => {
    setFormData({ ...formData, content: templateContent });
  };

  // 默认模板
  const defaultTemplate = `# ${(() => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })()} 日记

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

  // 如果目标日期已有日记，显示加载状态
  if (existingJournal) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">跳转到日记...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>新建日记 | Infer GTD</title>
          <meta name="description" content="创建日记" />
        </Head>

        <div className="space-y-6">
          {/* 头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center">
                <BookOpenIcon className="mr-2 h-6 w-6 text-orange-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">新建日记</h1>
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="mr-1 h-4 w-4" />
                    {targetDate.toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg bg-white shadow">
              <div className="px-6 py-4">
                {/* 工具栏 */}
                {formData.content.trim() === "" && (
                  <div className="mb-6 border-b border-gray-200 pb-4">
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
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    日记内容 *
                  </label>
                  <MarkdownEditor
                    value={formData.content}
                    onChange={(content) =>
                      setFormData({ ...formData, content })
                    }
                    placeholder="开始写日记..."
                    height={400}
                    preview="live"
                    enableJetBrainsShortcuts={true}
                    autoSave={true}
                    autoSaveType="local"
                    onAutoSave={handleAutoSave}
                  />
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.content.trim()}
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <BookOpenIcon className="mr-2 h-4 w-4" />
                      保存日记
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default NewJournalPage;

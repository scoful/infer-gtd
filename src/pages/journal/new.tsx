import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
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
  const today = new Date();

  // 检查今天是否已有日记
  const { data: existingJournal } = api.journal.getByDate.useQuery(
    { date: today },
    {
      enabled: !!sessionData,
    }
  );

  // 如果今天已有日记，重定向到编辑页面
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
      date: today,
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

  // 如果今天已有日记，显示加载状态
  if (existingJournal) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">跳转到今日日记...</p>
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
          <meta name="description" content="创建今日日记" />
        </Head>

        <div className="mx-auto max-w-4xl px-4 py-8">
          {/* 页面标题 */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="mr-1 h-4 w-4" />
                返回
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">新建日记</h1>
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
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg bg-white shadow">
              <div className="px-6 py-4">
                {/* 工具栏 */}
                <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
                  <div className="flex items-center space-x-2">
                    {/* 模板按钮 */}
                    {formData.content.trim() === "" && (
                      <button
                        type="button"
                        onClick={() => applyTemplate(defaultTemplate)}
                        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <BookOpenIcon className="mr-1 h-4 w-4" />
                        使用模板
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.content.trim()}
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? "保存中..." : "保存日记"}
                    </button>
                  </div>
                </div>

                {/* 日记内容 */}
                <div>
                  <MarkdownEditor
                    value={formData.content}
                    onChange={(content) =>
                      setFormData({ ...formData, content })
                    }
                    placeholder="开始写今天的日记..."
                    height={500}
                    preview="live"
                    enableJetBrainsShortcuts={true}
                    autoSave={true}
                    autoSaveType="local"
                    onAutoSave={handleAutoSave}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default NewJournalPage;

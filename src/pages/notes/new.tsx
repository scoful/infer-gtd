import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  BookmarkIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { MarkdownEditor } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagSelector } from "@/components/Tags";

interface NoteFormData {
  title: string;
  content: string;
  summary?: string;
  projectId?: string;
  tagIds: string[];
}

const NewNotePage: NextPage = () => {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();

  const [formData, setFormData] = useState<NoteFormData>({
    title: "",
    content: "",
    summary: "",
    tagIds: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取项目列表
  const { data: projectsData } = api.project.getAll.useQuery(
    { limit: 100 },
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 处理URL参数中的projectId
  useEffect(() => {
    if (router.isReady && router.query.projectId) {
      const projectId = router.query.projectId as string;
      setFormData((prev) => ({
        ...prev,
        projectId,
      }));
    }
  }, [router.isReady, router.query.projectId]);

  // 恢复本地草稿
  useEffect(() => {
    const draftKey = "note-draft-new";
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Partial<NoteFormData>;
        setFormData((prev) => ({
          ...prev,
          ...draft,
          tagIds: draft.tagIds || [],
          // 如果URL中有projectId参数，优先使用URL参数
          projectId: (router.query.projectId as string) || draft.projectId,
        }));
      } catch (error) {
        localStorage.removeItem(draftKey);
      }
    }
  }, [router.query.projectId]);

  // 创建笔记
  const createNote = api.note.create.useMutation({
    onSuccess: (result) => {
      showSuccess(`笔记创建成功`);
      // 清除草稿
      localStorage.removeItem("note-draft-new");
      setIsSubmitting(false);
      void router.push(`/notes/${result.id}`);
    },
    onError: (error) => {
      showError(error.message ?? "创建失败");
      setIsSubmitting(false);
    },
  });

  // 最终提交（创建笔记）
  const finalSubmit = () => {
    const saveData = {
      title: formData.title.trim(), // 标题仍然trim，避免前后空格
      content: formData.content, // 内容保持原始格式
      summary: formData.summary?.trim() || undefined,
      projectId: formData.projectId || undefined,
      tagIds: formData.tagIds,
    };

    createNote.mutate(saveData);
  };

  // 处理返回
  const handleBack = () => {
    void router.push("/notes");
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showError("请输入笔记标题");
      return;
    }

    if (!formData.content.trim()) {
      showError("请输入笔记内容");
      return;
    }

    setIsSubmitting(true);
    finalSubmit();
  };

  // 处理自动保存（本地草稿保存）
  const handleAutoSave = (content: string) => {
    // 准备保存数据
    const draftData = {
      title: formData.title,
      content: content,
      summary: formData.summary,
      projectId: formData.projectId,
      tagIds: formData.tagIds,
    };

    // 保存到本地存储
    const draftKey = "note-draft-new";
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch (error) {
      // 保存失败，静默处理
    }
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>新建笔记 | Infer GTD</title>
          <meta name="description" content="创建新的笔记" />
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
                <DocumentTextIcon className="mr-2 h-6 w-6 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">新建笔记</h1>
              </div>
            </div>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg bg-white shadow">
              <div className="px-6 py-4">
                {/* 标题 */}
                <div className="mb-6">
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700"
                  >
                    笔记标题 *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="输入笔记标题..."
                    required
                  />
                </div>

                {/* 摘要 */}
                <div className="mb-6">
                  <label
                    htmlFor="summary"
                    className="block text-sm font-medium text-gray-700"
                  >
                    笔记摘要
                  </label>
                  <textarea
                    id="summary"
                    value={formData.summary || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                    rows={2}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="简要描述笔记内容（可选）..."
                  />
                </div>

                {/* 笔记内容 */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    笔记内容 *
                  </label>
                  <MarkdownEditor
                    value={formData.content}
                    onChange={(content) =>
                      setFormData({ ...formData, content })
                    }
                    placeholder="开始编写你的笔记内容..."
                    height={400}
                    preview="live"
                    enableJetBrainsShortcuts={true}
                    autoSave={true}
                    autoSaveType="local"
                    onAutoSave={handleAutoSave}
                  />
                </div>

                {/* 项目选择 */}
                <div className="mb-6">
                  <label
                    htmlFor="project"
                    className="block text-sm font-medium text-gray-700"
                  >
                    关联项目
                  </label>
                  <div className="relative mt-1">
                    <FolderIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      id="project"
                      value={formData.projectId || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          projectId: e.target.value || undefined,
                        })
                      }
                      className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">选择项目（可选）</option>
                      {projectsData?.projects?.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 标签选择 */}
                <div className="mb-6">
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
                    sortable={true}
                    maxTags={10}
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
                  disabled={
                    isSubmitting ||
                    !formData.title.trim() ||
                    !formData.content.trim()
                  }
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      创建中...
                    </>
                  ) : (
                    <>
                      <BookmarkIcon className="mr-2 h-4 w-4" />
                      创建笔记
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

export default NewNotePage;

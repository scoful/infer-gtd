import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import MarkdownRenderer from "@/components/UI/MarkdownRenderer";
import JournalEditor from "@/components/Journal/JournalEditor";
import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { usePageRefresh } from "@/hooks/usePageRefresh";

const JournalDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { showSuccess, showError } = useGlobalNotifications();
  const [isEditing, setIsEditing] = useState(false);

  // 获取日记详情
  const {
    data: journal,
    isLoading,
    refetch,
  } = api.journal.getById.useQuery(
    { id: id as string },
    {
      enabled: !!id && typeof id === "string",
    }
  );

  // 删除日记
  const deleteJournal = api.journal.delete.useMutation({
    onSuccess: () => {
      showSuccess("日记删除成功");
      void router.push("/journal");
    },
    onError: (error) => {
      showError(error.message || "删除日记失败");
    },
  });

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    void refetch();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("确定要删除这篇日记吗？此操作无法撤销。")) {
      deleteJournal.mutate({ id: id as string });
    }
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">加载日记中...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  if (!journal) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">
                日记不存在
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                您要查看的日记不存在或已被删除
              </p>
              <button
                onClick={() => router.push("/journal")}
                className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                返回日记列表
              </button>
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
          <title>
            {new Date(journal.date).toLocaleDateString("zh-CN")} 日记 | Infer
            GTD
          </title>
          <meta name="description" content="查看日记详情" />
        </Head>

        {isEditing ? (
          <div className="flex h-full flex-col">
            {/* 编辑模式标题 */}
            <div className="border-b border-gray-200 bg-white px-4 py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="mr-1 h-4 w-4" />
                  取消编辑
                </button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    编辑日记
                  </h1>
                  <p className="text-sm text-gray-500">
                    {new Date(journal.date).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* 编辑器 */}
            <div className="flex-1 overflow-hidden">
              <JournalEditor
                date={new Date(journal.date)}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl px-4 py-8">
            {/* 页面标题和操作 */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="mr-1 h-4 w-4" />
                  返回
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {new Date(journal.date).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </h1>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <CalendarIcon className="mr-1 h-4 w-4" />
                      创建于{" "}
                      {new Date(journal.createdAt).toLocaleDateString("zh-CN")}
                    </div>
                    {journal.updatedAt !== journal.createdAt && (
                      <div className="flex items-center">
                        <ClockIcon className="mr-1 h-4 w-4" />
                        更新于{" "}
                        {new Date(journal.updatedAt).toLocaleDateString(
                          "zh-CN"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <PencilIcon className="mr-1 h-4 w-4" />
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteJournal.isPending}
                  className="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TrashIcon className="mr-1 h-4 w-4" />
                  {deleteJournal.isPending ? "删除中..." : "删除"}
                </button>
              </div>
            </div>

            {/* 日记内容 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <MarkdownRenderer content={journal.content} />
            </div>
          </div>
        )}
      </MainLayout>
    </AuthGuard>
  );
};

export default JournalDetailPage;

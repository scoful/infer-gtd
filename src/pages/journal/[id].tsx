import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
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
import { ConfirmModal, TOC } from "@/components/UI";
import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useConfirm } from "@/hooks/useConfirm";
import { useTOC } from "@/hooks/useTOC";

const JournalDetailPage: NextPage = () => {
  const router = useRouter();
  const { id, edit, from } = router.query;
  const { showSuccess, showError } = useGlobalNotifications();
  const { showConfirm, confirmState, hideConfirm } = useConfirm();
  const [isEditing, setIsEditing] = useState(false);

  // 检查 URL 参数，如果有 edit=true 则直接进入编辑模式
  useEffect(() => {
    if (edit === "true") {
      setIsEditing(true);
    }
  }, [edit]);

  // 获取日记详情
  const {
    data: journal,
    isLoading,
    refetch,
  } = api.journal.getById.useQuery(
    { id: id as string },
    {
      enabled: !!id && typeof id === "string",
    },
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

    // 如果是从其他页面进入编辑模式，返回到来源页面
    if (from) {
      if (from === "index") {
        void router.push("/journal");
      } else if (from === "list") {
        void router.push("/journal/list");
      } else {
        void router.push("/journal");
      }
    } else {
      // 如果没有来源信息，清除 URL 中的 edit 参数，留在当前详情页
      void router.replace(`/journal/${id as string}`, undefined, {
        shallow: true,
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);

    // 如果是从其他页面进入编辑模式，返回到来源页面
    if (from) {
      if (from === "index") {
        void router.push("/journal");
      } else if (from === "list") {
        void router.push("/journal/list");
      } else {
        void router.push("/journal");
      }
    } else {
      // 如果没有来源信息，清除 URL 中的 edit 参数，留在当前详情页
      void router.replace(`/journal/${id as string}`, undefined, {
        shallow: true,
      });
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: "删除日记",
      message: "确定要删除这篇日记吗？此操作无法撤销。",
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      deleteJournal.mutate({ id: id as string });
    }
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>
            {journal
              ? (() => {
                  const d = new Date(journal.date);
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${year}-${month}-${day}`;
                })()
              : "日记详情"}{" "}
            日记 | Infer GTD
          </title>
          <meta name="description" content="查看日记详情" />
        </Head>

        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">加载日记中...</p>
            </div>
          </div>
        ) : !journal ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">日记不存在</h3>
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
        ) : isEditing ? (
          <div className="flex h-full flex-col">
            {/* 编辑模式标题 */}
            <div className="border-b border-gray-200 bg-white px-4 py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                  title="取消编辑"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    编辑日记
                  </h1>
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
          <div className="space-y-6">
            {/* 页面标题和操作 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="mr-1 h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {(() => {
                      const d = new Date(journal.date);
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, "0");
                      const day = String(d.getDate()).padStart(2, "0");
                      return `${year}-${month}-${day}`;
                    })()}
                  </h1>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <CalendarIcon className="mr-1 h-4 w-4" />
                      创建于 {formatDate(journal.createdAt)}
                    </div>
                    {journal.updatedAt.getTime() !==
                      journal.createdAt.getTime() && (
                      <div className="flex items-center">
                        <ClockIcon className="mr-1 h-4 w-4" />
                        更新于 {formatDate(journal.updatedAt)}
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
            <div className="rounded-lg border border-gray-200 bg-white">
              <JournalContentWithTOC content={journal.content} />
            </div>
          </div>
        )}

        {/* 确认模态框 */}
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={hideConfirm}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          type={confirmState.type}
          isLoading={confirmState.isLoading}
        />
      </MainLayout>
    </AuthGuard>
  );
};

// 日记内容 + TOC 组件
function JournalContentWithTOC({ content }: { content: string }) {
  const tocItems = useTOC(content);

  return (
    <div className="flex gap-6">
      {/* TOC 侧边栏（桌面端显示） */}
      {tocItems.length > 0 && (
        <div className="hidden w-48 flex-shrink-0 pt-6 lg:block">
          <TOC items={tocItems} />
        </div>
      )}

      {/* 内容区域 */}
      <div className="min-w-0 flex-1 p-6">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

export default JournalDetailPage;

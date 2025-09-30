import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  ArrowLeftIcon,
  PencilIcon,
  ArchiveBoxIcon,
  TrashIcon,
  LinkIcon,
  TagIcon,
  FolderIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import {
  QueryLoading,
  SectionLoading,
  MarkdownRenderer,
  ConfirmModal,
  TOC,
} from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks/useConfirm";
import { NoteModal } from "@/components/Notes";
import { useTOC } from "@/hooks/useTOC";

const NoteDetailPage: NextPage = () => {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();
  const noteId = router.query.id as string;

  // 状态管理
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // 获取笔记详情
  const {
    data: note,
    isLoading,
    isFetching,
    refetch,
    error,
  } = api.note.getById.useQuery(
    { id: noteId },
    {
      enabled: !!sessionData && !!noteId,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 归档笔记
  const archiveNote = api.note.archive.useMutation({
    onSuccess: (result) => {
      showSuccess(`笔记已${result.note.isArchived ? "归档" : "取消归档"}`);
      void refetch();
    },
    onError: (error) => {
      showError(error.message ?? "操作失败");
    },
  });

  // 删除笔记
  const deleteNote = api.note.delete.useMutation({
    onSuccess: () => {
      showSuccess("笔记已删除");
      void router.push("/notes");
    },
    onError: (error) => {
      showError(error.message ?? "删除失败");
    },
    onSettled: () => {
      setLoading(false);
      hideConfirm();
    },
  });

  // 处理返回
  const handleBack = () => {
    void router.push("/notes");
  };

  // 处理编辑
  const handleEdit = () => {
    setIsNoteModalOpen(true);
  };

  // 处理归档
  const handleArchive = () => {
    if (!note) return;
    archiveNote.mutate({
      id: note.id,
      isArchived: !note.isArchived,
    });
  };

  // 处理删除
  const handleDelete = async () => {
    if (!note) return;

    const confirmed = await showConfirm({
      title: "确认删除笔记",
      message: `确定要删除笔记"${note.title}"吗？\n\n此操作无法撤销，笔记的所有内容都将被永久删除。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      try {
        setLoading(true);
        await deleteNote.mutateAsync({ id: note.id });
      } catch (error) {
        console.error("删除笔记失败:", error);
      }
    }
  };

  // 处理模态框成功
  const handleNoteModalSuccess = () => {
    void refetch();
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
          <title>{note?.title ?? "笔记详情"} | Infer GTD</title>
          <meta name="description" content="笔记详情页面" />
        </Head>

        {error ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">
                笔记不存在
              </h1>
              <p className="mb-4 text-gray-600">
                {error.message ?? "找不到指定的笔记"}
              </p>
              <button
                onClick={handleBack}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                返回笔记列表
              </button>
            </div>
          </div>
        ) : (
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载笔记详情中..."
            loadingComponent={<SectionLoading message="加载笔记详情中..." />}
          >
            {note && (
              <div className="space-y-6">
                {/* 页面头部 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={handleBack}
                      className="mr-4 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-4">
                      <h1 className="text-2xl font-bold text-gray-900">
                        笔记详情
                      </h1>
                      {isFetching && !isLoading && (
                        <div className="flex items-center text-sm text-blue-600">
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                          刷新中...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEdit}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      <PencilIcon className="mr-2 h-4 w-4" />
                      编辑
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={archiveNote.isPending}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ArchiveBoxIcon className="mr-2 h-4 w-4" />
                      {note.isArchived ? "取消归档" : "归档"}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteNote.isPending}
                      className="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      删除
                    </button>
                  </div>
                </div>

                {/* 笔记内容 */}
                <div className="rounded-lg border border-gray-200 bg-white">
                  {/* 笔记头部信息 */}
                  <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h1 className="mb-2 text-2xl font-bold text-gray-900">
                          {note.title}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-1 h-4 w-4" />
                            创建于 {formatDate(note.createdAt)}
                          </div>
                          {note.updatedAt.getTime() !==
                            note.createdAt.getTime() && (
                            <div className="flex items-center">
                              <ClockIcon className="mr-1 h-4 w-4" />
                              更新于 {formatDate(note.updatedAt)}
                            </div>
                          )}
                          {note.linkedTasks.length > 0 && (
                            <div className="flex items-center">
                              <LinkIcon className="mr-1 h-4 w-4" />
                              {note.linkedTasks.length} 个关联任务
                            </div>
                          )}
                        </div>
                      </div>
                      {note.isArchived && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                          <ArchiveBoxIcon className="mr-1 h-4 w-4" />
                          已归档
                        </span>
                      )}
                    </div>

                    {/* 项目和标签 */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.project && (
                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                          style={{
                            backgroundColor: note.project.color
                              ? `${note.project.color}20`
                              : "#f3f4f6",
                            color: note.project.color ?? "#6b7280",
                          }}
                        >
                          <FolderIcon className="mr-1 h-4 w-4" />
                          {note.project.name}
                        </span>
                      )}
                      {note.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                          style={{
                            backgroundColor: tag.color
                              ? `${tag.color}20`
                              : "#f3f4f6",
                            color: tag.color ?? "#6b7280",
                          }}
                        >
                          <TagIcon className="mr-1 h-4 w-4" />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 笔记内容 + TOC */}
                  <NoteContentWithTOC content={note.content} />
                </div>

                {/* 关联任务 */}
                {note.linkedTasks.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      关联任务
                    </h3>
                    <div className="space-y-3">
                      {note.linkedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div>
                            <h4 className="text-base font-medium text-gray-900">
                              {task.title}
                            </h4>
                            <p className="text-sm text-gray-500">
                              状态: {task.status}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push(`/tasks?id=${task.id}`)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            查看任务
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </QueryLoading>
        )}

        {/* 编辑模态框 */}
        <NoteModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          noteId={noteId}
          onSuccess={handleNoteModalSuccess}
        />

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

// 笔记内容 + TOC 组件
function NoteContentWithTOC({ content }: { content: string }) {
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
      <div className="min-w-0 flex-1 px-6 py-6">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

export default NoteDetailPage;

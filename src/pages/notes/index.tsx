import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  ArchiveBoxIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronDownIcon,
  TagIcon,
  FolderIcon,
  CalendarIcon,
  LinkIcon,
  EllipsisVerticalIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks/useConfirm";
import { NoteModal } from "@/components/Notes";

// 视图模式类型
type ViewMode = "grid" | "list";

// 排序选项类型
type SortOption = "updatedAt" | "createdAt" | "title";

const NotesPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 编辑笔记模态框状态
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // 批量选择状态
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  // 构建查询参数
  const queryParams = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      projectId: selectedProject || undefined,
      tagId: selectedTag || undefined,
      includeArchived,
      sortBy,
      sortOrder,
      limit: 20, // 每页显示20条笔记
    }),
    [
      searchQuery,
      selectedProject,
      selectedTag,
      includeArchived,
      sortBy,
      sortOrder,
    ],
  );

  // 获取笔记数据 - 使用无限查询支持分页
  const {
    data: notesData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.note.getAll.useInfiniteQuery(queryParams, {
    enabled: !!sessionData,
    staleTime: 30 * 1000, // 30秒缓存
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 获取项目数据用于筛选
  const { data: projectsData } = api.project.getAll.useQuery(
    { limit: 100 },
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 获取标签数据用于筛选
  const { data: tagsData } = api.tag.getAll.useQuery(
    { limit: 100 },
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 删除笔记
  const deleteNote = api.note.delete.useMutation({
    onSuccess: () => {
      showSuccess("笔记已删除");
      void refetch();
    },
    onError: (error) => {
      showError(error.message ?? "删除失败");
    },
    onSettled: () => {
      setLoading(false);
      hideConfirm();
    },
  });

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

  // 置顶笔记
  const pinNote = api.note.pin.useMutation({
    onSuccess: (result) => {
      showSuccess(`笔记已${result.note.isPinned ? "置顶" : "取消置顶"}`);
      void refetch();
    },
    onError: (error) => {
      showError(error.message ?? "操作失败");
    },
  });

  // 批量删除笔记
  const batchDeleteNotes = api.note.batchOperation.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void refetch();
      setSelectedNotes(new Set());
    },
    onError: (error) => {
      showError(error.message ?? "批量删除失败");
    },
    onSettled: () => {
      setLoading(false);
      hideConfirm();
    },
  });

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 注意：全局快捷键已在 MainLayout 中统一处理，这里不需要重复监听

  // 笔记数据处理 - 合并所有页面的数据
  const notes = notesData?.pages.flatMap((page) => page.notes) ?? [];
  const hasMorePages = hasNextPage;
  // 获取总数（从第一页获取，因为总数在所有页面都是一样的）
  const totalCount = notesData?.pages[0]?.totalCount ?? 0;

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // 清除所有筛选条件
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedProject(null);
    setSelectedTag(null);
    setIncludeArchived(false);
  };

  // 检查是否有活跃的筛选条件
  const hasActiveFilters =
    searchQuery || selectedProject || selectedTag || includeArchived;

  // 处理新建笔记
  const handleCreateNote = () => {
    void router.push("/notes/new");
  };

  // 处理编辑笔记
  const handleEditNote = (noteId: string) => {
    setEditingNoteId(noteId);
    setIsNoteModalOpen(true);
  };

  // 处理模态框关闭
  const handleNoteModalClose = () => {
    setIsNoteModalOpen(false);
    setEditingNoteId(null);
  };

  // 处理模态框成功
  const handleNoteModalSuccess = () => {
    void refetch();
  };

  // 处理查看笔记详情
  const handleViewNote = (noteId: string) => {
    void router.push(`/notes/${noteId}`);
  };

  // 处理删除笔记
  const handleDeleteNote = async (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    const noteTitle = note?.title ?? "此笔记";

    const confirmed = await showConfirm({
      title: "确认删除笔记",
      message: `确定要删除笔记"${noteTitle}"吗？\n\n此操作无法撤销，笔记的所有内容都将被永久删除。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      try {
        setLoading(true);
        await deleteNote.mutateAsync({ id: noteId });
      } catch (error) {
        console.error("删除笔记失败:", error);
      }
    }
  };

  // 处理笔记选择
  const handleNoteSelect = (noteId: string, selected: boolean) => {
    setSelectedNotes((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(noteId);
      } else {
        newSet.delete(noteId);
      }
      return newSet;
    });
  };

  // 处理全选
  const handleSelectAll = () => {
    if (notes.length === 0) return;

    const allNoteIds = notes.map((note) => note.id);
    const allSelected = allNoteIds.every((id) => selectedNotes.has(id));

    if (allSelected) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(allNoteIds));
    }
  };

  // 处理归档笔记
  const handleArchiveNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    archiveNote.mutate({
      id: noteId,
      isArchived: !note.isArchived,
    });
  };

  // 处理置顶笔记
  const handlePinNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    pinNote.mutate({
      id: noteId,
      isPinned: !note.isPinned,
    });
  };

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedNotes.size === 0) return;

    const noteCount = selectedNotes.size;
    const confirmed = await showConfirm({
      title: "确认删除笔记",
      message: `确定要删除选中的 ${noteCount} 篇笔记吗？\n\n删除后无法恢复，请谨慎操作。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await batchDeleteNotes.mutateAsync({
        noteIds: Array.from(selectedNotes),
        operation: "delete",
      });
    } catch (error) {
      console.error("批量删除失败:", error);
    }
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>笔记管理 | Infer GTD</title>
          <meta name="description" content="知识管理和文档整理" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">笔记管理</h1>
                {isFetching && !isLoading && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                知识管理和文档整理 • {notes.length} 个笔记
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* 视图切换 */}
              <div className="flex rounded-lg border border-gray-300 bg-white">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center px-3 py-2 text-sm font-medium ${
                    viewMode === "grid"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="网格视图"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center px-3 py-2 text-sm font-medium ${
                    viewMode === "list"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="列表视图"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>

              {/* 新建笔记按钮 */}
              <button
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={handleCreateNote}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                新建笔记
              </button>
            </div>
          </div>

          {/* 搜索和筛选 */}
          <div className="space-y-4">
            {/* 搜索栏 */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="搜索笔记标题或内容..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full rounded-md border-gray-300 py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 筛选条件 */}
            <div className="flex flex-wrap items-center gap-4">
              {/* 项目筛选 */}
              <div className="relative">
                <select
                  value={selectedProject ?? ""}
                  onChange={(e) => setSelectedProject(e.target.value || null)}
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">所有项目</option>
                  {projectsData?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>

              {/* 标签筛选 */}
              <div className="relative">
                <select
                  value={selectedTag || ""}
                  onChange={(e) => setSelectedTag(e.target.value || null)}
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">所有标签</option>
                  {tagsData?.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>

              {/* 排序选择 */}
              <div className="relative">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split(
                      "-",
                    ) as [SortOption, "asc" | "desc"];
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                  }}
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="updatedAt-desc">最近更新</option>
                  <option value="createdAt-desc">最近创建</option>
                  <option value="title-asc">标题 A-Z</option>
                  <option value="title-desc">标题 Z-A</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>

              {/* 包含归档 */}
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">包含归档</span>
              </label>

              {/* 清除筛选 */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>

          {/* 批量操作栏 */}
          {selectedNotes.size > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    已选择 {selectedNotes.size} 篇笔记
                  </span>
                  <button
                    onClick={() => setSelectedNotes(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    取消选择
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* 批量删除按钮 */}
                  <button
                    onClick={handleBatchDelete}
                    disabled={batchDeleteNotes.isPending}
                    className="flex items-center gap-1 rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`删除选中的 ${selectedNotes.size} 篇笔记`}
                  >
                    {batchDeleteNotes.isPending ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent"></div>
                        删除中...
                      </>
                    ) : (
                      <>🗑️ 删除 ({selectedNotes.size})</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 笔记列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载笔记列表中..."
            loadingComponent={<SectionLoading message="加载笔记列表中..." />}
          >
            {notes.length > 0 ? (
              <>
                {/* 全选控制 */}
                <div className="mb-4 flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        notes.length > 0 &&
                        notes.every((note) => selectedNotes.has(note.id))
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      全选 ({notes.length}/{totalCount} 篇笔记)
                    </span>
                  </label>

                  <div className="text-sm text-gray-500">
                    {selectedNotes.size > 0 &&
                      `已选择 ${selectedNotes.size} 篇`}
                  </div>
                </div>
                <div
                  className={`${
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                      : "space-y-4"
                  }`}
                >
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      viewMode={viewMode}
                      isSelected={selectedNotes.has(note.id)}
                      onSelect={(selected) =>
                        handleNoteSelect(note.id, selected)
                      }
                      onView={() => handleViewNote(note.id)}
                      onEdit={() => handleEditNote(note.id)}
                      onArchive={() => handleArchiveNote(note.id)}
                      onDelete={() => handleDeleteNote(note.id)}
                      onPin={() => handlePinNote(note.id)}
                    />
                  ))}
                </div>

                {/* 加载更多 */}
                {hasMorePages && (
                  <div className="py-4 text-center">
                    <button
                      onClick={() => {
                        void fetchNextPage();
                      }}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent"></div>
                          加载中...
                        </>
                      ) : (
                        "加载更多"
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {hasActiveFilters ? "没有找到匹配的笔记" : "还没有笔记"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {hasActiveFilters
                    ? "尝试调整搜索条件或筛选器"
                    : "创建第一个笔记来开始记录想法和知识"}
                </p>
                {!hasActiveFilters && (
                  <div className="mt-6">
                    <button
                      className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handleCreateNote}
                    >
                      <PlusIcon className="mr-2 h-4 w-4" />
                      新建笔记
                    </button>
                  </div>
                )}
              </div>
            )}
          </QueryLoading>
        </div>

        {/* 笔记编辑模态框 */}
        {editingNoteId && (
          <NoteModal
            isOpen={isNoteModalOpen}
            onClose={handleNoteModalClose}
            noteId={editingNoteId}
            onSuccess={handleNoteModalSuccess}
          />
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

// 笔记卡片组件类型定义
interface NoteCardProps {
  note: {
    id: string;
    title: string;
    content: string;
    summary?: string | null;
    isArchived: boolean;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    project?: {
      id: string;
      name: string;
      color?: string | null;
    } | null;
    tags: Array<{
      tag: {
        id: string;
        name: string;
        color?: string | null;
      };
    }>;
    linkedTasks: Array<{
      id: string;
      title: string;
      status: string;
    }>;
    _count: {
      linkedTasks: number;
    };
  };
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
}

// 笔记卡片组件
function NoteCard({
  note,
  viewMode,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onArchive,
  onDelete,
  onPin,
}: NoteCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);
  // 移除getDisplayPreview函数，现在只显示摘要

  // 格式化日期
  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    // 当天内：显示时分
    if (today.getTime() === dateDay.getTime()) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // 7天内：显示周几时分
    else if (diffInDays < 7) {
      return date.toLocaleDateString("zh-CN", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // 7天以上：显示月日时分
    else {
      return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (viewMode === "list") {
    return (
      <div
        className={`flex h-full min-h-[200px] flex-col rounded-lg border bg-white p-6 transition-shadow hover:shadow-md ${
          isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
        }`}
      >
        {/* 顶部区域：选择框和操作按钮 */}
        <div className="mb-4 flex items-start justify-between">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />

          {/* 操作按钮 */}
          <div className="ml-4 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-gray-400 hover:text-gray-600"
              title="编辑笔记"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
              className={`${
                note.isPinned
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title={note.isPinned ? "取消置顶" : "置顶笔记"}
            >
              {note.isPinned ? (
                <BookmarkSolidIcon className="h-5 w-5" />
              ) : (
                <BookmarkIcon className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className={`${
                note.isArchived
                  ? "text-orange-500 hover:text-orange-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title={note.isArchived ? "取消归档" : "归档笔记"}
            >
              <ArchiveBoxIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-gray-400 hover:text-red-600"
              title="删除笔记"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 中间内容区域 - 可伸缩 */}
        <div className="flex-1 cursor-pointer" onClick={onView}>
          {/* 标题和状态 */}
          <div className="mb-3">
            <div className="flex items-start justify-between">
              <h3 className="line-clamp-2 flex-1 text-lg font-medium text-gray-900">
                {note.title}
              </h3>
              <div className="ml-2 flex flex-col gap-1">
                {note.isPinned && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                    <BookmarkSolidIcon className="mr-1 h-3 w-3" />
                    置顶
                  </span>
                )}
                {note.isArchived && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                    已归档
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 摘要预览 - 只在有摘要时显示 */}
          {note.summary?.trim() && (
            <p className="mb-4 line-clamp-3 text-sm text-gray-600">
              {note.summary.length > 150
                ? note.summary.substring(0, 150) + "..."
                : note.summary}
            </p>
          )}

          {/* 项目和标签 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {note.project && (
              <span
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: note.project.color
                    ? `${note.project.color}20`
                    : "#f3f4f6",
                  color: note.project.color || "#6b7280",
                }}
              >
                <FolderIcon className="mr-1 h-3 w-3" />
                {note.project.name}
              </span>
            )}
            {note.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: tag.color ? `${tag.color}20` : "#f3f4f6",
                  color: tag.color || "#6b7280",
                }}
              >
                <TagIcon className="mr-1 h-3 w-3" />
                {tag.name}
              </span>
            ))}
          </div>
        </div>

        {/* 底部信息 - 时间固定左下角，其他信息右侧 */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <CalendarIcon className="mr-1 h-3 w-3" />
            {formatDate(note.updatedAt)}
          </div>
          <div className="flex items-center gap-3">
            {note._count.linkedTasks > 0 && (
              <div className="flex items-center">
                <LinkIcon className="mr-1 h-3 w-3" />
                {note._count.linkedTasks}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 网格视图
  return (
    <div
      className={`flex h-full min-h-[280px] flex-col rounded-lg border bg-white p-6 transition-shadow hover:shadow-md ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
      }`}
    >
      {/* 顶部区域：选择框和菜单 */}
      <div className="mb-3 flex items-start justify-between">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />

        {/* 三个竖点菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="text-gray-400 hover:text-gray-600"
            title="更多操作"
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>

          {/* 下拉菜单 */}
          {isMenuOpen && (
            <div className="absolute right-0 top-6 z-10 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <PencilIcon className="mr-2 h-4 w-4" />
                编辑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onPin();
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {note.isPinned ? (
                  <BookmarkSolidIcon className="mr-2 h-4 w-4 text-yellow-500" />
                ) : (
                  <BookmarkIcon className="mr-2 h-4 w-4" />
                )}
                {note.isPinned ? "取消置顶" : "置顶"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onArchive();
                }}
                className={`flex w-full items-center px-3 py-2 text-sm ${
                  note.isArchived
                    ? "text-orange-700 hover:bg-orange-50"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <ArchiveBoxIcon
                  className={`mr-2 h-4 w-4 ${
                    note.isArchived ? "text-orange-500" : ""
                  }`}
                />
                {note.isArchived ? "取消归档" : "归档"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 中间内容区域 - 可伸缩 */}
      <div className="flex-1 cursor-pointer" onClick={onView}>
        {/* 标题和状态 */}
        <div className="mb-3">
          <div className="flex items-start justify-between">
            <h3 className="line-clamp-2 flex-1 text-lg font-medium text-gray-900">
              {note.title}
            </h3>
            <div className="ml-2 flex flex-col gap-1">
              {note.isPinned && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                  <BookmarkSolidIcon className="mr-1 h-3 w-3" />
                  置顶
                </span>
              )}
              {note.isArchived && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                  已归档
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 摘要预览 - 只在有摘要时显示 */}
        {note.summary?.trim() && (
          <p className="mb-4 line-clamp-3 text-sm text-gray-600">
            {note.summary.length > 150
              ? note.summary.substring(0, 150) + "..."
              : note.summary}
          </p>
        )}

        {/* 项目和标签 */}
        <div className="mb-4 flex flex-wrap gap-1">
          {note.project && (
            <span
              className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
              style={{
                backgroundColor: note.project.color
                  ? `${note.project.color}20`
                  : "#f3f4f6",
                color: note.project.color || "#6b7280",
              }}
            >
              <FolderIcon className="mr-1 h-3 w-3" />
              {note.project.name}
            </span>
          )}
          {note.tags.slice(0, 3).map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}20` : "#f3f4f6",
                color: tag.color || "#6b7280",
              }}
            >
              <TagIcon className="mr-1 h-3 w-3" />
              {tag.name}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* 底部信息 - 时间固定左下角，其他信息右侧 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center">
          <CalendarIcon className="mr-1 h-3 w-3" />
          {formatDate(note.updatedAt)}
        </div>
        <div className="flex items-center gap-3">
          {note._count.linkedTasks > 0 && (
            <div className="flex items-center">
              <LinkIcon className="mr-1 h-3 w-3" />
              {note._count.linkedTasks}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotesPage;

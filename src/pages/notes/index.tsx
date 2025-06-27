import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import {
  ArchiveBoxIcon,
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronDownIcon,
  TagIcon,
  FolderIcon,
  CalendarIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { NoteModal } from "@/components/Notes";

// 视图模式类型
type ViewMode = "grid" | "list";

// 排序选项类型
type SortOption = "updatedAt" | "createdAt" | "title";

const NotesPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const router = useRouter();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 模态框状态
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // 构建查询参数
  const queryParams = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      projectId: selectedProject || undefined,
      tagId: selectedTag || undefined,
      includeArchived,
      sortBy,
      sortOrder,
      limit: 50,
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

  // 获取笔记数据
  const {
    data: notesData,
    isLoading,
    isFetching,
    refetch,
  } = api.note.getAll.useQuery(queryParams, {
    enabled: !!sessionData,
    staleTime: 30 * 1000, // 30秒缓存
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

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

  const notes = notesData?.notes ?? [];

  // 处理新建笔记
  const handleCreateNote = () => {
    setEditingNoteId(null);
    setIsNoteModalOpen(true);
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

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>笔记 | Infer GTD</title>
          <meta name="description" content="知识管理和文档整理" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">笔记</h1>
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
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
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
                className="block w-full rounded-md border-gray-300 py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* 筛选条件 */}
            <div className="flex flex-wrap items-center gap-4">
              {/* 项目筛选 */}
              <div className="relative">
                <select
                  value={selectedProject || ""}
                  onChange={(e) => setSelectedProject(e.target.value || null)}
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                  className="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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

          {/* 笔记列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载笔记列表中..."
            loadingComponent={<SectionLoading message="加载笔记列表中..." />}
          >
            {notes.length > 0 ? (
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
                    onView={() => handleViewNote(note.id)}
                    onEdit={() => handleEditNote(note.id)}
                    onArchive={() => {
                      // TODO: 实现归档笔记功能
                      console.log("归档笔记", note.id);
                    }}
                  />
                ))}
              </div>
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
                      className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
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

        {/* 笔记模态框 */}
        <NoteModal
          isOpen={isNoteModalOpen}
          onClose={handleNoteModalClose}
          noteId={editingNoteId ?? undefined}
          onSuccess={handleNoteModalSuccess}
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
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

// 笔记卡片组件
function NoteCard({
  note,
  viewMode,
  onView,
  onEdit,
  onArchive,
}: NoteCardProps) {
  // 获取显示的预览内容
  const getDisplayPreview = (maxLength = 150) => {
    // 优先显示摘要
    if (note.summary?.trim()) {
      return note.summary.length > maxLength
        ? note.summary.substring(0, maxLength) + "..."
        : note.summary;
    }

    // 如果没有摘要，则从内容生成预览
    const plainText = note.content
      .replace(/#{1,6}\s+/g, "") // 移除标题
      .replace(/\*\*(.*?)\*\*/g, "$1") // 移除粗体
      .replace(/\*(.*?)\*/g, "$1") // 移除斜体
      .replace(/`(.*?)`/g, "$1") // 移除行内代码
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // 移除链接
      .replace(/\n+/g, " ") // 替换换行为空格
      .trim();

    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + "..."
      : plainText;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString("zh-CN", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
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
        className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
        onClick={onView}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {/* 标题和状态 */}
            <div className="mb-2 flex items-center gap-2">
              <h3 className="truncate text-lg font-medium text-gray-900">
                {note.title}
              </h3>
              {note.isArchived && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  <ArchiveBoxIcon className="mr-1 h-3 w-3" />
                  已归档
                </span>
              )}
            </div>

            {/* 内容预览 */}
            <p className="mb-3 line-clamp-2 text-sm text-gray-600">
              {getDisplayPreview(200)}
            </p>

            {/* 元数据 */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center">
                <CalendarIcon className="mr-1 h-3 w-3" />
                更新于 {formatDate(note.updatedAt)}
              </div>
              {note._count.linkedTasks > 0 && (
                <div className="flex items-center">
                  <LinkIcon className="mr-1 h-3 w-3" />
                  {note._count.linkedTasks} 个关联任务
                </div>
              )}
            </div>
          </div>

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
              <EyeIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="text-gray-400 hover:text-gray-600"
              title={note.isArchived ? "取消归档" : "归档笔记"}
            >
              <ArchiveBoxIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 项目和标签 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
    );
  }

  // 网格视图
  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
      onClick={onView}
    >
      {/* 标题和状态 */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="line-clamp-2 flex-1 text-lg font-medium text-gray-900">
          {note.title}
        </h3>
        <div className="ml-2 flex items-center gap-2">
          {note.isArchived && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              已归档
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-gray-400 hover:text-gray-600"
            title="编辑笔记"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 内容预览 */}
      <p className="mb-4 line-clamp-3 text-sm text-gray-600">
        {getDisplayPreview()}
      </p>

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

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center">
          <CalendarIcon className="mr-1 h-3 w-3" />
          {formatDate(note.updatedAt)}
        </div>
        {note._count.linkedTasks > 0 && (
          <div className="flex items-center">
            <LinkIcon className="mr-1 h-3 w-3" />
            {note._count.linkedTasks}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesPage;

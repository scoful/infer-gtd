import { type NextPage } from "next";
import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
  BookOpenIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks/useConfirm";

// 视图模式类型
type ViewMode = "grid" | "list";

// 排序选项类型
type SortOption = "date" | "createdAt" | "updatedAt";

const JournalListPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const { showConfirm, confirmState, hideConfirm, setLoading } = useConfirm();

  // 状态管理
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set());

  // 筛选状态
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [templateFilter, setTemplateFilter] = useState<string>("");

  // 构建查询参数
  const queryParams = {
    limit: 20,
    search: searchQuery.trim() || undefined,
    sortBy,
    sortOrder,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    template: templateFilter || undefined,
  };

  // 获取日记数据 - 使用无限查询支持分页
  const {
    data: journalsData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.journal.getAll.useInfiniteQuery(queryParams, {
    enabled: !!sessionData,
    staleTime: 30 * 1000, // 30秒缓存
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 获取模板统计数据用于筛选
  const { data: templateStats } = api.journal.getTemplateStats.useQuery(
    undefined,
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  );

  // 删除日记
  const deleteJournal = api.journal.delete.useMutation({
    onSuccess: () => {
      showSuccess("日记删除成功");
      void refetch();
    },
    onError: (error) => {
      showError(error.message || "删除日记失败");
    },
  });

  // 批量删除日记
  const batchDeleteJournals = api.journal.batchDelete.useMutation({
    onSuccess: (data) => {
      showSuccess(data.message);
      setSelectedJournals(new Set());
      void refetch();
    },
    onError: (error) => {
      showError(error.message || "批量删除日记失败");
    },
  });

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 处理数据
  const journals = journalsData?.pages.flatMap((page) => page.journals) || [];
  const totalCount = journalsData?.pages[0]?.totalCount || 0;

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void refetch();
  };

  // 处理筛选重置
  const handleResetFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setTemplateFilter("");
    setSortBy("date");
    setSortOrder("desc");
  };

  // 处理日记选择
  const handleJournalSelect = (journalId: string, selected: boolean) => {
    const newSelected = new Set(selectedJournals);
    if (selected) {
      newSelected.add(journalId);
    } else {
      newSelected.delete(journalId);
    }
    setSelectedJournals(newSelected);
  };

  // 处理全选
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedJournals(new Set(journals.map((journal) => journal.id)));
    } else {
      setSelectedJournals(new Set());
    }
  };

  // 查看日记
  const handleViewJournal = (journalId: string) => {
    void router.push(`/journal/${journalId}`);
  };

  // 编辑日记
  const handleEditJournal = (journalId: string) => {
    void router.push(`/journal/${journalId}?edit=true`);
  };

  // 删除日记
  const handleDeleteJournal = async (journalId: string) => {
    const journal = journals.find((j) => j.id === journalId);
    if (!journal) return;

    const confirmed = await showConfirm({
      title: "删除日记",
      message: `确定要删除 ${new Date(journal.date).toLocaleDateString("zh-CN")} 的日记吗？此操作无法撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      deleteJournal.mutate({ id: journalId });
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedJournals.size === 0) return;

    const confirmed = await showConfirm({
      title: "批量删除日记",
      message: `确定要删除选中的 ${selectedJournals.size} 篇日记吗？此操作无法撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      batchDeleteJournals.mutate({
        journalIds: Array.from(selectedJournals),
      });
    }
  };

  // 新建日记
  const handleNewJournal = () => {
    void router.push("/journal/today");
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>日记列表 | Infer GTD</title>
          <meta name="description" content="管理和浏览所有日记" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">日记列表</h1>
              <p className="mt-1 text-sm text-gray-600">
                管理和浏览所有日记记录
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleNewJournal}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                写日记
              </button>
            </div>
          </div>

          {/* 搜索和筛选栏 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <form onSubmit={handleSearch} className="space-y-4">
              {/* 搜索框和视图切换 */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center space-x-2">
                  <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索日记内容..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full rounded-md border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isFetching}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFetching ? (
                      <>
                        <div className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        搜索中...
                      </>
                    ) : (
                      "搜索"
                    )}
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  {/* 筛选按钮 */}
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                      showFilters
                        ? "bg-blue-100 text-blue-700"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <FunnelIcon className="mr-1 h-4 w-4" />
                    筛选
                  </button>

                  {/* 视图切换 */}
                  <div className="flex rounded-md border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                        viewMode === "grid"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Squares2X2Icon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`inline-flex items-center border-l border-gray-300 px-3 py-2 text-sm font-medium ${
                        viewMode === "list"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <ListBulletIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 高级筛选 */}
              {showFilters && (
                <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      开始日期
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      结束日期
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      模板筛选
                    </label>
                    <select
                      value={templateFilter}
                      onChange={(e) => setTemplateFilter(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">所有模板</option>
                      {templateStats?.map((stat) => (
                        <option key={stat.template} value={stat.template || ""}>
                          {stat.template || "无模板"} ({stat.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      排序方式
                    </label>
                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split("-") as [SortOption, "asc" | "desc"];
                        setSortBy(field);
                        setSortOrder(order);
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="date-desc">日期 (新到旧)</option>
                      <option value="date-asc">日期 (旧到新)</option>
                      <option value="updatedAt-desc">更新时间 (新到旧)</option>
                      <option value="updatedAt-asc">更新时间 (旧到新)</option>
                      <option value="createdAt-desc">创建时间 (新到旧)</option>
                      <option value="createdAt-asc">创建时间 (旧到新)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      重置筛选
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* 批量操作栏 */}
          {selectedJournals.size > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-blue-700">
                  已选择 {selectedJournals.size} 篇日记
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBatchDelete}
                    disabled={batchDeleteJournals.isPending}
                    className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {batchDeleteJournals.isPending ? (
                      <>
                        <div className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        删除中...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="mr-1 h-4 w-4" />
                        批量删除
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedJournals(new Set())}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    取消选择
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 日记列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载日记列表中..."
            loadingComponent={<SectionLoading message="加载日记列表中..." />}
          >
            {journals.length > 0 ? (
              <>
                {/* 全选控制 */}
                <div className="mb-4 flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        journals.length > 0 &&
                        journals.every((journal) => selectedJournals.has(journal.id))
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      全选 ({journals.length}/{totalCount} 篇日记)
                    </span>
                  </label>

                  <div className="text-sm text-gray-500">
                    {selectedJournals.size > 0 &&
                      `已选择 ${selectedJournals.size} 篇`}
                  </div>
                </div>

                {/* 日记卡片/列表 */}
                <div
                  className={`${
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                      : "space-y-4"
                  }`}
                >
                  {journals.map((journal) => (
                    <JournalCard
                      key={journal.id}
                      journal={journal}
                      viewMode={viewMode}
                      isSelected={selectedJournals.has(journal.id)}
                      onSelect={(selected) =>
                        handleJournalSelect(journal.id, selected)
                      }
                      onView={() => handleViewJournal(journal.id)}
                      onEdit={() => handleEditJournal(journal.id)}
                      onDelete={() => handleDeleteJournal(journal.id)}
                    />
                  ))}
                </div>

                {/* 加载更多按钮 */}
                {hasNextPage && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => void fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
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
                <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {searchQuery || startDate || endDate || templateFilter
                    ? "没有找到匹配的日记"
                    : "还没有日记"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery || startDate || endDate || templateFilter
                    ? "尝试调整搜索条件或筛选器"
                    : "开始记录你的第一篇日记吧"}
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleNewJournal}
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    写日记
                  </button>
                </div>
              </div>
            )}
          </QueryLoading>
        </div>

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

export default JournalListPage;

// 日记卡片组件类型定义
interface JournalCardProps {
  journal: {
    id: string;
    date: Date;
    content: string;
    template?: string | null;
    createdAt: Date;
    updatedAt: Date;
    preview?: string;
    wordCount?: number;
  };
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// 日记卡片组件
function JournalCard({
  journal,
  viewMode,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
}: JournalCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const getPreview = () => {
    if (journal.preview) return journal.preview;
    return journal.content.substring(0, 150) + (journal.content.length > 150 ? "..." : "");
  };

  const getWordCount = () => {
    return journal.wordCount || journal.content.length;
  };

  if (viewMode === "list") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">
                  {formatDate(journal.date)}
                </h3>
                {journal.template && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {journal.template}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {getPreview()}
              </p>
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center">
                  <DocumentTextIcon className="mr-1 h-3 w-3" />
                  {journal.wordCount || journal.content.length} 字
                </span>
                <span className="flex items-center">
                  <ClockIcon className="mr-1 h-3 w-3" />
                  {new Date(journal.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2 sm:ml-4 sm:space-x-2">
            <button
              onClick={onView}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-2"
            >
              <EyeIcon className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">查看</span>
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-2"
            >
              <PencilIcon className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">编辑</span>
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center rounded-md border border-red-300 bg-white px-1.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 sm:px-2"
            >
              <TrashIcon className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">删除</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 网格视图
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-10 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  onView();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <EyeIcon className="mr-2 h-4 w-4" />
                查看
              </button>
              <button
                onClick={() => {
                  onEdit();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <PencilIcon className="mr-2 h-4 w-4" />
                编辑
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">
            {formatDate(journal.date)}
          </h3>
        </div>

        {journal.template && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
            {journal.template}
          </span>
        )}

        <p className="text-sm text-gray-600 line-clamp-3">
          {getPreview()}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center">
            <DocumentTextIcon className="mr-1 h-3 w-3" />
            {journal.wordCount || journal.content.length} 字
          </span>
          <span className="flex items-center">
            <ClockIcon className="mr-1 h-3 w-3" />
            {new Date(journal.updatedAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>
    </div>
  );
}

import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useMemo, useCallback } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { TagType } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import {
  TagDisplay,
  TagList,
  TagGroupDisplay,
  type TagData,
} from "@/components/Tags";
import TagModal from "@/components/Tags/TagModal";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks";
import { usePageRefresh } from "@/hooks/usePageRefresh";

// 筛选状态接口
interface FilterState {
  search: string;
  type: TagType | "ALL";
  category: string | "ALL";
  includeSystem: boolean;
}

// 排序字段类型
type SortField = "name" | "type" | "createdAt" | "usage";
type SortDirection = "asc" | "desc";

const TagManagementPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const { showSuccess, showError } = useGlobalNotifications();

  // 状态管理
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid" | "grouped">("list");
  const [showFilters, setShowFilters] = useState(false);

  // 确认模态框状态
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

  // 筛选和排序状态
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    type: "ALL",
    category: "ALL",
    includeSystem: true,
  });
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: any = {
      limit: 100,
      includeSystem: filters.includeSystem,
    };

    if (filters.search.trim()) {
      params.search = filters.search.trim();
    }

    if (filters.type !== "ALL") {
      params.type = filters.type;
    }

    if (filters.category !== "ALL") {
      params.category = filters.category;
    }

    return params;
  }, [filters]);

  // 获取标签数据
  const {
    data: tagsData,
    isLoading,
    refetch,
    isFetching,
  } = api.tag.getAll.useQuery(queryParams, {
    enabled: !!sessionData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // 获取标签统计
  const { data: tagStats, refetch: refetchStats } = api.tag.getStats.useQuery(
    undefined,
    { enabled: !!sessionData },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([refetch(), refetchStats()]);
  }, [refetch, refetchStats]);

  // 删除标签的mutation
  const deleteTagMutation = api.tag.delete.useMutation({
    onSuccess: () => {
      showSuccess("标签删除成功");
      void refetch();
    },
    onError: (error) => {
      showError(`删除标签失败: ${error.message}`);
    },
  });

  // 批量删除标签的mutation
  const batchDeleteTagsMutation = api.tag.batchDelete.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      setSelectedTags(new Set());
      void refetch();
    },
    onError: (error) => {
      showError(`批量删除标签失败: ${error.message}`);
    },
  });

  // 处理标签删除
  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      const confirmed = await showConfirm({
        title: "确认删除标签",
        message: "确定要删除这个标签吗？删除后无法恢复。",
        confirmText: "删除",
        cancelText: "取消",
        type: "danger",
      });

      if (!confirmed) {
        return;
      }

      try {
        setLoading(true);
        await deleteTagMutation.mutateAsync({ id: tagId });
        // 删除成功，不需要额外处理，mutation的onSuccess会处理
      } catch (error: any) {
        // 不要在这里console.error，避免开发环境的Runtime Error

        // 如果是标签被引用的错误，显示友好的提示信息
        if (error?.data?.code === "CONFLICT") {
          const errorMessage = error.message || "标签正在被使用，无法删除";

          // 延迟显示确认框，确保当前的确认框先关闭
          setTimeout(() => {
            void showConfirm({
              title: "无法删除标签",
              message: errorMessage,
              confirmText: "我知道了",
              cancelText: "",
              type: "warning",
            });
          }, 100);
        } else {
          // 其他错误显示通用错误信息
          showError(`删除标签失败: ${error.message || "未知错误"}`);
        }
      } finally {
        setLoading(false);
        hideConfirm();
      }
    },
    [deleteTagMutation, showConfirm, setLoading, hideConfirm, showError],
  );

  // 处理批量删除标签
  const handleBatchDeleteTags = useCallback(async () => {
    if (selectedTags.size === 0) return;

    const confirmed = await showConfirm({
      title: "确认批量删除标签",
      message: `确定要删除选中的 ${selectedTags.size} 个标签吗？\n\n删除后无法恢复，请谨慎操作。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await batchDeleteTagsMutation.mutateAsync({
        tagIds: Array.from(selectedTags),
      });
    } catch (error: any) {
      // 如果是标签被引用的错误，显示友好的提示信息
      if (error?.data?.code === "CONFLICT") {
        const errorMessage = error.message || "部分标签正在被使用，无法删除";

        // 延迟显示确认框，确保当前的确认框先关闭
        setTimeout(() => {
          void showConfirm({
            title: "无法删除标签",
            message: errorMessage,
            confirmText: "我知道了",
            cancelText: "",
            type: "warning",
          });
        }, 100);
      } else {
        // 其他错误显示通用错误信息
        showError(`批量删除标签失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setLoading(false);
      hideConfirm();
    }
  }, [
    selectedTags,
    batchDeleteTagsMutation,
    showConfirm,
    setLoading,
    hideConfirm,
    showError,
  ]);

  // 处理标签编辑
  const handleEditTag = useCallback((tag: TagData) => {
    setEditingTag(tag);
    setShowCreateModal(true);
  }, []);

  // 处理标签选择
  const handleTagSelect = useCallback((tagId: string, selected: boolean) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(tagId);
      } else {
        newSet.delete(tagId);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (!tagsData?.tags) return;

    const allTagIds = tagsData.tags.map((tag) => tag.id);
    const allSelected = allTagIds.every((id) => selectedTags.has(id));

    if (allSelected) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(allTagIds));
    }
  }, [tagsData?.tags, selectedTags]);

  // 处理筛选更新
  const handleFilterUpdate = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // 清空筛选
  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      type: "ALL",
      category: "ALL",
      includeSystem: true,
    });
  }, []);

  // 处理模态框关闭
  const handleModalClose = useCallback(() => {
    setShowCreateModal(false);
    setEditingTag(null);
  }, []);

  // 处理模态框成功
  const handleModalSuccess = useCallback(() => {
    void refetch();
    handleModalClose();
  }, [refetch, handleModalClose]);

  // 标签数据处理和排序
  const sortedTags = useMemo(() => {
    if (!tagsData?.tags) return [];

    const tags = [...tagsData.tags];

    // 客户端排序
    tags.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "usage":
          aValue = (a._count?.taskTags || 0) + (a._count?.noteTags || 0);
          bValue = (b._count?.taskTags || 0) + (b._count?.noteTags || 0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return tags;
  }, [tagsData?.tags, sortField, sortDirection]);

  // 获取标签类型标签
  const getTagTypeLabel = (type: TagType): string => {
    const labels = {
      [TagType.CONTEXT]: "上下文",
      [TagType.PROJECT]: "项目",
      [TagType.PRIORITY]: "优先级",
      [TagType.CUSTOM]: "自定义",
    };
    return labels[type];
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>标签管理 | Infer GTD</title>
          <meta name="description" content="管理和组织您的标签" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和统计 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">标签管理</h1>
              </div>
              {isFetching && !isLoading && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  刷新中...
                </div>
              )}
            </div>

            {/* 统计信息 */}
            {tagStats && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <TagIcon className="h-4 w-4" />
                  <span>总计 {tagStats.total}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ChartBarIcon className="h-4 w-4" />
                  <span>系统 {tagStats.system}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>自定义 {tagStats.custom}</span>
                </div>
              </div>
            )}
          </div>

          {/* 操作栏 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {/* 新建标签按钮 */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                新建标签
              </button>

              {/* 视图切换 */}
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-l-md border px-3 py-2 text-sm font-medium ${
                    viewMode === "list"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  列表
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`border-t border-b px-3 py-2 text-sm font-medium ${
                    viewMode === "grid"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  网格
                </button>
                <button
                  onClick={() => setViewMode("grouped")}
                  className={`rounded-r-md border px-3 py-2 text-sm font-medium ${
                    viewMode === "grouped"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  分组
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 筛选按钮 */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
                  showFilters
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FunnelIcon className="mr-2 h-4 w-4" />
                筛选
              </button>

              {/* 搜索框 */}
              <div className="relative max-w-md">
                <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索标签..."
                  value={filters.search}
                  onChange={(e) =>
                    handleFilterUpdate({ search: e.target.value })
                  }
                  className="block w-full rounded-md border border-gray-300 py-2 pr-3 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 筛选面板 */}
          {showFilters && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {/* 类型筛选 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    标签类型
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) =>
                      handleFilterUpdate({
                        type: e.target.value as TagType | "ALL",
                      })
                    }
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="ALL">所有类型</option>
                    <option value={TagType.CONTEXT}>上下文</option>
                    <option value={TagType.PROJECT}>项目</option>
                    <option value={TagType.PRIORITY}>优先级</option>
                    <option value={TagType.CUSTOM}>自定义</option>
                  </select>
                </div>

                {/* 系统标签筛选 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    标签来源
                  </label>
                  <select
                    value={filters.includeSystem ? "all" : "custom"}
                    onChange={(e) =>
                      handleFilterUpdate({
                        includeSystem: e.target.value === "all",
                      })
                    }
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="all">全部标签</option>
                    <option value="custom">仅自定义</option>
                  </select>
                </div>

                {/* 排序字段 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    排序方式
                  </label>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="name">名称</option>
                    <option value="type">类型</option>
                    <option value="usage">使用次数</option>
                    <option value="createdAt">创建时间</option>
                  </select>
                </div>

                {/* 排序方向 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    排序顺序
                  </label>
                  <select
                    value={sortDirection}
                    onChange={(e) =>
                      setSortDirection(e.target.value as SortDirection)
                    }
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="asc">升序</option>
                    <option value="desc">降序</option>
                  </select>
                </div>

                {/* 清空筛选 */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
                  >
                    清空筛选
                  </button>
                </div>
              </div>

              {/* 筛选结果统计 */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-500">
                  {sortedTags.length} 个标签
                  {(filters.search ||
                    filters.type !== "ALL" ||
                    !filters.includeSystem) &&
                    ` (已筛选)`}
                </div>
              </div>
            </div>
          )}

          {/* 批量操作栏 */}
          {selectedTags.size > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    已选择 {selectedTags.size} 个标签
                  </span>
                  <button
                    onClick={() => setSelectedTags(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    取消选择
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBatchDeleteTags}
                    disabled={batchDeleteTagsMutation.isPending}
                    className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`删除选中的 ${selectedTags.size} 个标签`}
                  >
                    {batchDeleteTagsMutation.isPending ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent"></div>
                        删除中...
                      </>
                    ) : (
                      <>批量删除 ({selectedTags.size})</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 标签列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载标签列表中..."
            loadingComponent={<SectionLoading message="加载标签列表中..." />}
          >
            {sortedTags.length > 0 ? (
              <div className="space-y-4">
                {/* 全选控制 */}
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={
                        sortedTags.length > 0 &&
                        sortedTags.every((tag) => selectedTags.has(tag.id))
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      全选 ({sortedTags.length} 个标签)
                    </span>
                  </label>

                  <div className="text-sm text-gray-500">
                    {selectedTags.size > 0 && `已选择 ${selectedTags.size} 个`}
                  </div>
                </div>

                {/* 标签内容 */}
                {viewMode === "grouped" ? (
                  <TagGroupDisplay
                    tags={sortedTags}
                    size="md"
                    variant="outline"
                    showIcon={true}
                    className="rounded-lg border border-gray-200 bg-white p-6"
                  />
                ) : (
                  <div
                    className={` ${
                      viewMode === "grid"
                        ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "space-y-3"
                    } `}
                  >
                    {sortedTags.map((tag) => (
                      <TagManagementCard
                        key={tag.id}
                        tag={tag}
                        isSelected={selectedTags.has(tag.id)}
                        onSelect={(selected) =>
                          handleTagSelect(tag.id, selected)
                        }
                        onEdit={() => handleEditTag(tag)}
                        onDelete={() => handleDeleteTag(tag.id)}
                        viewMode={viewMode}
                        getTagTypeLabel={getTagTypeLabel}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
                <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  暂无标签
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search ||
                  filters.type !== "ALL" ||
                  !filters.includeSystem
                    ? "没有找到符合条件的标签"
                    : "开始创建您的第一个标签吧"}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    新建标签
                  </button>
                </div>
              </div>
            )}
          </QueryLoading>
        </div>

        {/* 标签创建/编辑模态框 */}
        <TagModal
          isOpen={showCreateModal}
          onClose={handleModalClose}
          tag={editingTag}
          onSuccess={handleModalSuccess}
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

// 标签管理卡片组件
interface TagManagementCardProps {
  tag: TagData;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  viewMode: "list" | "grid" | "grouped";
  getTagTypeLabel: (type: TagType) => string;
}

function TagManagementCard({
  tag,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  viewMode,
  getTagTypeLabel,
}: TagManagementCardProps) {
  const usageCount = ((tag as any)._count?.taskTags || 0) + ((tag as any)._count?.noteTags || 0);

  return (
    <div
      className={`rounded-lg border bg-white p-4 transition-all duration-200 ${
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      } ${viewMode === "grid" ? "h-full" : ""} `}
    >
      <div className="flex items-start gap-3">
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />

        {/* 标签内容 */}
        <div className="min-w-0 flex-1">
          {/* 标签显示和操作 */}
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <TagDisplay
                tag={tag}
                size="md"
                variant="default"
                showIcon={true}
                className="mb-2"
              />

              {/* 标签信息 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                    {getTagTypeLabel(tag.type)}
                  </span>
                  {tag.isSystem && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                      系统标签
                    </span>
                  )}
                </div>

                {tag.description && (
                  <p className="line-clamp-2 text-xs text-gray-600">
                    {tag.description}
                  </p>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="ml-2 flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                title="编辑标签"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              {!tag.isSystem && (
                <button
                  onClick={onDelete}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="删除标签"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* 底部统计信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>使用次数: {usageCount}</span>
              {tag.category && <span>分类: {tag.category}</span>}
            </div>
            <span>{new Date((tag as any).createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TagManagementPage;

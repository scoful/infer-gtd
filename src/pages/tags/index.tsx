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
import { QueryLoading, SectionLoading } from "@/components/UI";
import { TagDisplay, TagList, TagGroupDisplay, type TagData } from "@/components/Tags";
import TagModal from "@/components/Tags/TagModal";
import { useNotifications } from "@/hooks";
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
  const { showSuccess, showError } = useNotifications();

  // 状态管理
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid" | "grouped">("list");
  const [showFilters, setShowFilters] = useState(false);
  
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
  const { data: tagsData, isLoading, refetch, isFetching } = api.tag.getAll.useQuery(
    queryParams,
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
    }
  );

  // 获取标签统计
  const { data: tagStats, refetch: refetchStats } = api.tag.getStats.useQuery(
    undefined,
    { enabled: !!sessionData }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetch(),
      refetchStats(),
    ]);
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

  // 处理标签删除
  const handleDeleteTag = useCallback(async (tagId: string) => {
    if (confirm("确定要删除这个标签吗？删除后无法恢复。")) {
      try {
        await deleteTagMutation.mutateAsync({ id: tagId });
      } catch (error) {
        console.error("删除标签失败:", error);
      }
    }
  }, [deleteTagMutation]);

  // 处理标签编辑
  const handleEditTag = useCallback((tag: TagData) => {
    setEditingTag(tag);
    setShowCreateModal(true);
  }, []);

  // 处理标签选择
  const handleTagSelect = useCallback((tagId: string, selected: boolean) => {
    setSelectedTags(prev => {
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
    
    const allTagIds = tagsData.tags.map(tag => tag.id);
    const allSelected = allTagIds.every(id => selectedTags.has(id));
    
    if (allSelected) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(allTagIds));
    }
  }, [tagsData?.tags, selectedTags]);

  // 处理筛选更新
  const handleFilterUpdate = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
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
          <title>标签管理 | Smart GTD</title>
          <meta name="description" content="管理和组织您的标签" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和统计 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">标签管理</h1>

              </div>
              {isFetching && !isLoading && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* 新建标签按钮 */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新建标签
              </button>

              {/* 视图切换 */}
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                    viewMode === "list"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  列表
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 text-sm font-medium border-t border-b ${
                    viewMode === "grid"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  网格
                </button>
                <button
                  onClick={() => setViewMode("grouped")}
                  className={`px-3 py-2 text-sm font-medium rounded-r-md border ${
                    viewMode === "grouped"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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
                className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                  showFilters
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                筛选
              </button>

              {/* 搜索框 */}
              <div className="relative max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索标签..."
                  value={filters.search}
                  onChange={(e) => handleFilterUpdate({ search: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 筛选面板 */}
          {showFilters && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* 类型筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签类型
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterUpdate({ type: e.target.value as TagType | "ALL" })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签来源
                </label>
                <select
                  value={filters.includeSystem ? "all" : "custom"}
                  onChange={(e) => handleFilterUpdate({ includeSystem: e.target.value === "all" })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">全部标签</option>
                  <option value="custom">仅自定义</option>
                </select>
              </div>

              {/* 排序字段 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  排序方式
                </label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">名称</option>
                  <option value="type">类型</option>
                  <option value="usage">使用次数</option>
                  <option value="createdAt">创建时间</option>
                </select>
              </div>

              {/* 排序方向 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  排序顺序
                </label>
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="asc">升序</option>
                  <option value="desc">降序</option>
                </select>
              </div>

              {/* 清空筛选 */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  清空筛选
                </button>
              </div>
            </div>

            {/* 筛选结果统计 */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {sortedTags.length} 个标签
                {(filters.search || filters.type !== "ALL" || !filters.includeSystem) &&
                  ` (已筛选)`
                }
              </div>
            </div>
          </div>
          )}

          {/* 批量操作栏 */}
          {selectedTags.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                    onClick={() => {
                      // 批量删除功能
                      if (confirm(`确定要删除选中的 ${selectedTags.size} 个标签吗？`)) {
                        console.log("批量删除功能待实现");
                      }
                    }}
                    className="px-3 py-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                  >
                    批量删除
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
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sortedTags.length > 0 && sortedTags.every(tag => selectedTags.has(tag.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                    className="bg-white rounded-lg border border-gray-200 p-6"
                  />
                ) : (
                  <div className={`
                    ${viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "space-y-3"
                    }
                  `}>
                    {sortedTags.map((tag) => (
                      <TagManagementCard
                        key={tag.id}
                        tag={tag}
                        isSelected={selectedTags.has(tag.id)}
                        onSelect={(selected) => handleTagSelect(tag.id, selected)}
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
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无标签</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search || filters.type !== "ALL" || !filters.includeSystem
                    ? "没有找到符合条件的标签"
                    : "开始创建您的第一个标签吧"
                  }
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
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
  const usageCount = (tag._count?.taskTags || 0) + (tag._count?.noteTags || 0);

  return (
    <div
      className={`
        bg-white rounded-lg border p-4 transition-all duration-200
        ${isSelected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-gray-200 hover:shadow-md hover:border-gray-300"
        }
        ${viewMode === "grid" ? "h-full" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />

        {/* 标签内容 */}
        <div className="flex-1 min-w-0">
          {/* 标签显示和操作 */}
          <div className="flex items-start justify-between mb-3">
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
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {getTagTypeLabel(tag.type)}
                  </span>
                  {tag.isSystem && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      系统标签
                    </span>
                  )}
                </div>

                {tag.description && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {tag.description}
                  </p>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={onEdit}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="编辑标签"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              {!tag.isSystem && (
                <button
                  onClick={onDelete}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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
              {tag.category && (
                <span>分类: {tag.category}</span>
              )}
            </div>
            <span>
              {new Date(tag.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TagManagementPage;

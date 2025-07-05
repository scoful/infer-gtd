import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { useRouter } from "next/router";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { SectionLoading, ConfirmModal } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks";
import SavedSearchCard from "@/components/Search/SavedSearchCard";
import SavedSearchModal, { type SavedSearchFormData } from "@/components/Search/SavedSearchModal";

const SavedSearchesPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const { showConfirm, confirmState, hideConfirm } = useConfirm();

  // 状态管理
  const [isSavedSearchModalOpen, setIsSavedSearchModalOpen] = useState(false);
  const [savedSearchFormData, setSavedSearchFormData] = useState<SavedSearchFormData | undefined>();
  const [editingSearchId, setEditingSearchId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // API 调用
  const { data: savedSearches, refetch: refetchSavedSearches, isLoading } =
    api.search.getSavedSearches.useQuery(undefined, { enabled: !!sessionData });

  const { data: tags } = api.tag.getAll.useQuery(
    { limit: 100 },
    { enabled: !!sessionData },
  );

  const { data: projects } = api.project.getAll.useQuery(
    { limit: 100 }, 
    { enabled: !!sessionData }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetchSavedSearches();
  }, [refetchSavedSearches]);



  // 更新保存的搜索
  const updateSavedSearchMutation = api.search.updateSavedSearch.useMutation({
    onSuccess: (data) => {
      void refetchSavedSearches();
      showSuccess(`搜索 "${data.name}" 更新成功`);
      setIsSavedSearchModalOpen(false);
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        showError("搜索名称已存在，请使用其他名称");
      } else {
        showError(error.message || "更新保存的搜索失败");
      }
    },
  });

  // 删除保存的搜索
  const deleteSavedSearchMutation = api.search.deleteSavedSearch.useMutation({
    onSuccess: () => {
      void refetchSavedSearches();
      showSuccess("保存的搜索已删除");
    },
    onError: (error) => {
      showError(error.message || "删除保存的搜索失败");
    },
  });

  // 生成搜索条件摘要
  const generateSearchSummary = useCallback((searchParams: any, tags?: any[], projects?: any[]) => {
    const conditions = [];

    if (searchParams.query) {
      conditions.push(`关键词: "${searchParams.query}"`);
    }

    if (searchParams.searchIn && searchParams.searchIn.length > 0 && searchParams.searchIn.length < 4) {
      const typeMap: Record<string, string> = {
        tasks: "任务",
        notes: "笔记",
        projects: "项目",
        journals: "日记"
      };
      const types = searchParams.searchIn.map((type: string) => typeMap[type] || type);
      conditions.push(`范围: ${types.join("、")}`);
    }

    if (searchParams.taskStatus && searchParams.taskStatus.length > 0) {
      const statusMap: Record<string, string> = {
        IDEA: "想法",
        TODO: "待办",
        IN_PROGRESS: "进行中",
        WAITING: "等待中",
        COMPLETED: "已完成",
        CANCELLED: "已取消"
      };
      const statuses = searchParams.taskStatus.map((status: string) => statusMap[status] || status);
      conditions.push(`状态: ${statuses.join("、")}`);
    }

    if (searchParams.priority && searchParams.priority.length > 0) {
      const priorityMap: Record<string, string> = {
        LOW: "低",
        MEDIUM: "中",
        HIGH: "高",
        URGENT: "紧急"
      };
      const priorities = searchParams.priority.map((p: string) => priorityMap[p] || p);
      conditions.push(`优先级: ${priorities.join("、")}`);
    }

    // 标签筛选
    if (searchParams.tagIds && searchParams.tagIds.length > 0 && tags) {
      const selectedTags = tags.filter(tag => searchParams.tagIds.includes(tag.id));
      if (selectedTags.length > 0) {
        const tagNames = selectedTags.map(tag => tag.name);
        conditions.push(`标签: ${tagNames.join("、")}`);
      }
    }

    // 项目筛选
    if (searchParams.projectIds && searchParams.projectIds.length > 0 && projects) {
      const selectedProjects = projects.filter(project => searchParams.projectIds.includes(project.id));
      if (selectedProjects.length > 0) {
        const projectNames = selectedProjects.map(project => project.name);
        conditions.push(`项目: ${projectNames.join("、")}`);
      }
    }

    if (searchParams.sortBy && searchParams.sortBy !== "relevance") {
      const sortMap: Record<string, string> = {
        createdAt: "创建时间",
        updatedAt: "更新时间",
        dueDate: "截止时间",
        priority: "优先级",
        title: "标题",
        timeSpent: "耗时"
      };
      const sortName = sortMap[searchParams.sortBy] || searchParams.sortBy;
      const orderName = searchParams.sortOrder === "asc" ? "升序" : "降序";
      conditions.push(`排序: ${sortName}${orderName}`);
    }

    return conditions.length > 0 ? conditions.join(" | ") : "无特定条件";
  }, []);

  // 加载保存的搜索
  const handleLoadSavedSearch = useCallback((search: any) => {
    // 跳转到高级搜索页面并应用搜索条件
    const params = new URLSearchParams();
    const searchParams = search.searchParams;
    
    if (searchParams.query) params.set('q', searchParams.query);
    if (searchParams.searchIn) params.set('searchIn', searchParams.searchIn.join(','));
    if (searchParams.taskStatus) params.set('taskStatus', searchParams.taskStatus.join(','));
    if (searchParams.priority) params.set('priority', searchParams.priority.join(','));
    if (searchParams.tagIds) params.set('tagIds', searchParams.tagIds.join(','));
    if (searchParams.projectIds) params.set('projectIds', searchParams.projectIds.join(','));
    if (searchParams.sortBy) params.set('sortBy', searchParams.sortBy);
    if (searchParams.sortOrder) params.set('sortOrder', searchParams.sortOrder);

    void router.push(`/search?${params.toString()}`);
  }, [router]);

  // 删除保存的搜索
  const handleDeleteSavedSearch = useCallback(async (searchId: string, searchName: string) => {
    const confirmed = await showConfirm({
      title: "确认删除保存的搜索",
      message: `确定要删除保存的搜索"${searchName}"吗？\n\n此操作无法撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      deleteSavedSearchMutation.mutate({ id: searchId });
    }
  }, [deleteSavedSearchMutation, showConfirm]);

  // 打开编辑搜索模态框
  const handleOpenSaveModal = useCallback((search: any) => {
    // 编辑模式
    setSavedSearchFormData({
      name: search.name,
      description: search.description || "",
    });
    setEditingSearchId(search.id);
    setIsEditMode(true);
    setIsSavedSearchModalOpen(true);
  }, []);

  // 保存搜索（编辑模式）
  const handleSaveSearchNew = useCallback((formData: SavedSearchFormData) => {
    if (isEditMode && editingSearchId) {
      // 更新现有搜索
      updateSavedSearchMutation.mutate({
        id: editingSearchId,
        ...formData,
        searchParams: {}, // 编辑时不更新搜索参数
      });
    }
  }, [isEditMode, editingSearchId, updateSavedSearchMutation]);

  // 过滤搜索结果
  const filteredSearches = savedSearches?.filter(search => 
    search.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (search.description && search.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  if (!sessionData) {
    return null;
  }

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>保存的搜索 | Infer GTD</title>
          <meta name="description" content="管理保存的搜索" />
        </Head>

        <div className="container mx-auto px-4 py-8">
          {/* 页面标题和操作 */}
          <div className="mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">保存的搜索</h1>
                <p className="mt-1 text-sm text-gray-600">
                  管理您保存的搜索条件，快速重复使用常用搜索
                </p>
              </div>
              
              <button
                onClick={() => router.push('/search')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                高级搜索
              </button>
            </div>

            {/* 搜索框 */}
            <div className="mt-6">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索保存的搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 搜索结果 */}
          {isLoading ? (
            <SectionLoading />
          ) : filteredSearches.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSearches.map((search) => (
                <SavedSearchCard
                  key={search.id}
                  search={search}
                  onLoad={handleLoadSavedSearch}
                  onEdit={handleOpenSaveModal}
                  onDelete={handleDeleteSavedSearch}
                  generateSearchSummary={generateSearchSummary}
                  tags={tags}
                  projects={projects}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                {searchQuery ? "未找到匹配的搜索" : "暂无保存的搜索"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {searchQuery
                  ? "尝试使用不同的关键词搜索"
                  : "在高级搜索页面进行搜索后，可以保存搜索条件以便快速重复使用"
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => router.push('/search')}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  开始搜索
                </button>
              )}
            </div>
          )}

          {/* 保存搜索模态框 */}
          <SavedSearchModal
            isOpen={isSavedSearchModalOpen}
            onClose={() => setIsSavedSearchModalOpen(false)}
            onSave={handleSaveSearchNew}
            initialData={savedSearchFormData}
            mode={isEditMode ? "edit" : "create"}
            isLoading={updateSavedSearchMutation.isPending}
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
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default SavedSearchesPage;

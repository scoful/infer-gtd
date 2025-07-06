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

  const { data: tags, isLoading: isLoadingTags } = api.tag.getAll.useQuery(
    { limit: 100 },
    { enabled: !!sessionData },
  );

  const { data: projects, isLoading: isLoadingProjects } = api.project.getAll.useQuery(
    { limit: 100 },
    { enabled: !!sessionData }
  );

  console.log("数据加载状态:", {
    isLoadingTags,
    isLoadingProjects,
    tagsCount: tags?.tags?.length,
    projectsCount: projects?.projects?.length,
    sessionData: !!sessionData
  });

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

  // 生成搜索条件摘要（结构化）
  const generateSearchConditions = useCallback((searchParams: any, tags?: any[], projects?: any[]) => {
    console.log("generateSearchConditions 被调用:", {
      searchParams,
      tagsData: tags,
      projectsData: projects
    });
    const conditions: Array<{
      type: 'keyword' | 'scope' | 'status' | 'type' | 'priority' | 'tag' | 'project' | 'time' | 'tracking' | 'sort';
      label: string;
      value: string;
      color: string;
    }> = [];

    if (searchParams.query) {
      conditions.push({
        type: 'keyword',
        label: '关键词',
        value: `"${searchParams.query}"`,
        color: 'bg-blue-100 text-blue-800 border border-blue-200'
      });
    }

    if (searchParams.searchIn && searchParams.searchIn.length > 0) {
      const typeMap: Record<string, string> = {
        tasks: "任务",
        notes: "笔记",
        projects: "项目",
        journals: "日记"
      };
      const types = searchParams.searchIn.map((type: string) => typeMap[type] || type);

      // 如果是全部4种类型，显示"全部"
      const displayValue = searchParams.searchIn.length === 4 ? "全部" : types.join("、");

      conditions.push({
        type: 'scope',
        label: '范围',
        value: displayValue,
        color: 'bg-purple-100 text-purple-800 border border-purple-200'
      });
    }

    // 状态筛选 - 分成独立标签
    if (searchParams.taskStatus && searchParams.taskStatus.length > 0) {
      const statusMap: Record<string, string> = {
        IDEA: "想法",
        TODO: "待办",
        IN_PROGRESS: "进行中",
        WAITING: "等待中",
        DONE: "已完成",
        COMPLETED: "已完成",
        ARCHIVED: "已归档",
        CANCELLED: "已取消"
      };

      searchParams.taskStatus.forEach((status: string) => {
        const statusName = statusMap[status] || status;
        conditions.push({
          type: 'status',
          label: '状态',
          value: statusName,
          color: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        });
      });
    }

    // 任务类型筛选 - 分成独立标签
    if (searchParams.taskType && searchParams.taskType.length > 0) {
      const typeMap: Record<string, string> = {
        SINGLE: "单次任务",
        RECURRING: "重复任务"
      };

      searchParams.taskType.forEach((type: string) => {
        const typeName = typeMap[type] || type;
        conditions.push({
          type: 'type',
          label: '任务类型',
          value: typeName,
          color: 'bg-indigo-100 text-indigo-800 border border-indigo-200'
        });
      });
    }

    // 优先级筛选 - 分成独立标签
    if (searchParams.priority && searchParams.priority.length > 0) {
      const priorityMap: Record<string, string> = {
        LOW: "低",
        MEDIUM: "中",
        HIGH: "高",
        URGENT: "紧急"
      };

      searchParams.priority.forEach((priority: string) => {
        const priorityName = priorityMap[priority] || priority;
        conditions.push({
          type: 'priority',
          label: '优先级',
          value: priorityName,
          color: 'bg-rose-100 text-rose-800 border border-rose-200'
        });
      });
    }

    // 标签筛选
    if (searchParams.tagIds && searchParams.tagIds.length > 0 && tags && tags.length > 0) {
      console.log("标签筛选调试:", {
        tagIds: searchParams.tagIds,
        availableTags: tags.map(t => ({ id: t.id, name: t.name })),
        tagIdsType: typeof searchParams.tagIds[0],
        availableTagIdsType: typeof tags[0]?.id
      });

      // 确保类型匹配 - 将所有ID转换为字符串进行比较
      const searchTagIds = searchParams.tagIds.map((id: any) => String(id));
      const selectedTags = tags.filter(tag => searchTagIds.includes(String(tag.id)));

      if (selectedTags.length > 0) {
        // 标签筛选 - 分成独立标签
        selectedTags.forEach(tag => {
          conditions.push({
            type: 'tag',
            label: '标签',
            value: tag.name,
            color: 'bg-amber-100 text-amber-800 border border-amber-200'
          });
        });
      } else {
        console.log("没有找到匹配的标签，尝试类型转换后仍无匹配");
      }
    } else {
      console.log("标签筛选条件不满足:", {
        hasTagIds: !!searchParams.tagIds,
        tagIdsLength: searchParams.tagIds?.length,
        hasTags: !!tags,
        tagsLength: tags?.length
      });
    }

    // 标签类型筛选 - 分成独立标签
    if (searchParams.tagTypes && searchParams.tagTypes.length > 0) {
      const tagTypeMap: Record<string, string> = {
        CONTEXT: "情境",
        ENERGY: "精力",
        TIME: "时间",
        PERSON: "人员",
        LOCATION: "地点",
        TOOL: "工具",
        PROJECT: "项目",
        AREA: "领域",
        CUSTOM: "自定义"
      };

      searchParams.tagTypes.forEach((tagType: string) => {
        const typeName = tagTypeMap[tagType] || tagType;
        conditions.push({
          type: 'tag',
          label: '标签类型',
          value: typeName,
          color: 'bg-yellow-100 text-yellow-800 border border-yellow-200'
        });
      });
    }

    // 项目筛选
    if (searchParams.projectIds && searchParams.projectIds.length > 0 && projects && projects.length > 0) {
      // 确保类型匹配 - 将所有ID转换为字符串进行比较
      const searchProjectIds = searchParams.projectIds.map((id: any) => String(id));
      const selectedProjects = projects.filter(project => searchProjectIds.includes(String(project.id)));
      if (selectedProjects.length > 0) {
        // 项目筛选 - 分成独立标签
        selectedProjects.forEach(project => {
          conditions.push({
            type: 'project',
            label: '项目',
            value: project.name,
            color: 'bg-sky-100 text-sky-800 border border-sky-200'
          });
        });
      }
    }

    // 统一的日期格式化函数
    const formatDate = (dateValue: any) => {
      try {
        if (!dateValue) return null;
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return String(dateValue);
        return date.toLocaleDateString("zh-CN");
      } catch {
        return String(dateValue);
      }
    };

    // 收集所有时间条件，合并显示
    const timeConditions = [];

    // 创建时间筛选
    if (searchParams.createdAfter || searchParams.createdBefore) {
      const formattedAfter = formatDate(searchParams.createdAfter);
      const formattedBefore = formatDate(searchParams.createdBefore);

      if (formattedAfter && formattedBefore) {
        timeConditions.push(`创建时间: ${formattedAfter} 至 ${formattedBefore}`);
      } else if (formattedAfter) {
        timeConditions.push(`创建时间: ${formattedAfter} 之后`);
      } else if (formattedBefore) {
        timeConditions.push(`创建时间: ${formattedBefore} 之前`);
      }
    }

    // 更新时间筛选
    if (searchParams.updatedAfter || searchParams.updatedBefore) {
      const formattedAfter = formatDate(searchParams.updatedAfter);
      const formattedBefore = formatDate(searchParams.updatedBefore);

      if (formattedAfter && formattedBefore) {
        timeConditions.push(`更新时间: ${formattedAfter} 至 ${formattedBefore}`);
      } else if (formattedAfter) {
        timeConditions.push(`更新时间: ${formattedAfter} 之后`);
      } else if (formattedBefore) {
        timeConditions.push(`更新时间: ${formattedBefore} 之前`);
      }
    }

    // 截止时间筛选
    if (searchParams.dueAfter || searchParams.dueBefore) {
      const formattedAfter = formatDate(searchParams.dueAfter);
      const formattedBefore = formatDate(searchParams.dueBefore);

      if (formattedAfter && formattedBefore) {
        timeConditions.push(`截止时间: ${formattedAfter} 至 ${formattedBefore}`);
      } else if (formattedAfter) {
        timeConditions.push(`截止时间: ${formattedAfter} 之后`);
      } else if (formattedBefore) {
        timeConditions.push(`截止时间: ${formattedBefore} 之前`);
      }
    }

    // 如果有时间条件，合并为一个标签显示（换行格式）
    if (timeConditions.length > 0) {
      const timeValue = '时间筛选:\n' + timeConditions.join('\n');
      conditions.push({
        type: 'time',
        label: '时间筛选',
        value: timeValue,
        color: 'bg-orange-100 text-orange-800 border border-orange-200'
      });
    }

    // 时间跟踪筛选
    if (searchParams.hasTimeTracking !== undefined && searchParams.hasTimeTracking !== null) {
      conditions.push({
        type: 'tracking',
        label: '时间跟踪',
        value: searchParams.hasTimeTracking ? "有" : "无",
        color: 'bg-teal-100 text-teal-800 border border-teal-200'
      });
    }

    if (searchParams.minTimeSpent !== undefined || searchParams.maxTimeSpent !== undefined) {
      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
        }
        return `${minutes}分钟`;
      };

      let timeValue = '';
      if (searchParams.minTimeSpent !== undefined && searchParams.maxTimeSpent !== undefined) {
        timeValue = `${formatTime(searchParams.minTimeSpent)} 至 ${formatTime(searchParams.maxTimeSpent)}`;
      } else if (searchParams.minTimeSpent !== undefined) {
        timeValue = `≥ ${formatTime(searchParams.minTimeSpent)}`;
      } else if (searchParams.maxTimeSpent !== undefined) {
        timeValue = `≤ ${formatTime(searchParams.maxTimeSpent)}`;
      }

      if (timeValue) {
        conditions.push({
          type: 'tracking',
          label: '耗时',
          value: timeValue,
          color: 'bg-teal-100 text-teal-800 border border-teal-200'
        });
      }
    }

    // 其他状态筛选
    if (searchParams.isCompleted !== undefined && searchParams.isCompleted !== null) {
      conditions.push({
        type: 'status',
        label: '完成状态',
        value: searchParams.isCompleted ? "已完成" : "未完成",
        color: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      });
    }

    if (searchParams.isOverdue !== undefined && searchParams.isOverdue !== null) {
      conditions.push({
        type: 'status',
        label: '逾期状态',
        value: searchParams.isOverdue ? "已逾期" : "未逾期",
        color: 'bg-red-100 text-red-800 border border-red-200'
      });
    }

    if (searchParams.isRecurring !== undefined && searchParams.isRecurring !== null) {
      conditions.push({
        type: 'type',
        label: '重复任务',
        value: searchParams.isRecurring ? "是" : "否",
        color: 'bg-indigo-100 text-indigo-800 border border-indigo-200'
      });
    }

    if (searchParams.hasDescription !== undefined && searchParams.hasDescription !== null) {
      conditions.push({
        type: 'status',
        label: '描述',
        value: searchParams.hasDescription ? "有描述" : "无描述",
        color: 'bg-gray-100 text-gray-800 border border-gray-200'
      });
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
      conditions.push({
        type: 'sort',
        label: '排序',
        value: `${sortName}${orderName}`,
        color: 'bg-slate-100 text-slate-800 border border-slate-200'
      });
    }

    return conditions;
  }, []);

  // 生成搜索条件摘要（文本版本，用于兼容）
  const generateSearchSummary = useCallback((searchParams: any, tags?: any[], projects?: any[]) => {
    const conditions = generateSearchConditions(searchParams, tags, projects);
    return conditions.length > 0
      ? conditions.map(c => `${c.label}: ${c.value}`).join(" | ")
      : "无特定条件";
  }, [generateSearchConditions]);

  // 加载保存的搜索
  const handleLoadSavedSearch = useCallback((search: any) => {
    // 跳转到高级搜索页面并应用搜索条件
    const params = new URLSearchParams();
    const searchParams = search.searchParams;

    // 基础搜索参数
    if (searchParams.query) params.set('q', searchParams.query);
    if (searchParams.searchIn) params.set('searchIn', searchParams.searchIn.join(','));

    // 任务相关筛选
    if (searchParams.taskStatus && searchParams.taskStatus.length > 0) {
      params.set('taskStatus', searchParams.taskStatus.join(','));
    }
    if (searchParams.taskType && searchParams.taskType.length > 0) {
      params.set('taskType', searchParams.taskType.join(','));
    }
    if (searchParams.priority && searchParams.priority.length > 0) {
      params.set('priority', searchParams.priority.join(','));
    }

    // 标签和项目筛选
    if (searchParams.tagIds && searchParams.tagIds.length > 0) {
      params.set('tagIds', searchParams.tagIds.join(','));
    }
    if (searchParams.tagTypes && searchParams.tagTypes.length > 0) {
      params.set('tagTypes', searchParams.tagTypes.join(','));
    }
    if (searchParams.projectIds && searchParams.projectIds.length > 0) {
      params.set('projectIds', searchParams.projectIds.join(','));
    }

    // 时间筛选
    if (searchParams.createdAfter) {
      params.set('createdAfter', searchParams.createdAfter);
    }
    if (searchParams.createdBefore) {
      params.set('createdBefore', searchParams.createdBefore);
    }
    if (searchParams.updatedAfter) {
      params.set('updatedAfter', searchParams.updatedAfter);
    }
    if (searchParams.updatedBefore) {
      params.set('updatedBefore', searchParams.updatedBefore);
    }
    if (searchParams.dueAfter) {
      params.set('dueAfter', searchParams.dueAfter);
    }
    if (searchParams.dueBefore) {
      params.set('dueBefore', searchParams.dueBefore);
    }

    // 状态筛选
    if (searchParams.isCompleted !== undefined && searchParams.isCompleted !== null) {
      params.set('isCompleted', String(searchParams.isCompleted));
    }
    if (searchParams.isOverdue !== undefined && searchParams.isOverdue !== null) {
      params.set('isOverdue', String(searchParams.isOverdue));
    }
    if (searchParams.isRecurring !== undefined && searchParams.isRecurring !== null) {
      params.set('isRecurring', String(searchParams.isRecurring));
    }
    if (searchParams.hasDescription !== undefined && searchParams.hasDescription !== null) {
      params.set('hasDescription', String(searchParams.hasDescription));
    }

    // 时间跟踪筛选
    if (searchParams.hasTimeTracking !== undefined && searchParams.hasTimeTracking !== null) {
      params.set('hasTimeTracking', String(searchParams.hasTimeTracking));
    }
    if (searchParams.minTimeSpent !== undefined) {
      params.set('minTimeSpent', String(searchParams.minTimeSpent));
    }
    if (searchParams.maxTimeSpent !== undefined) {
      params.set('maxTimeSpent', String(searchParams.maxTimeSpent));
    }

    // 排序参数
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

  // 编辑搜索条件
  const handleEditSearchConditions = useCallback((search: any) => {
    // 构建查询参数，将搜索条件编码到URL中
    const searchParams = search.searchParams;
    const queryParams = new URLSearchParams();

    // 基础搜索词
    if (searchParams.query) {
      queryParams.set('q', searchParams.query);
    }

    // 搜索范围
    if (searchParams.searchIn && searchParams.searchIn.length > 0) {
      queryParams.set('searchIn', searchParams.searchIn.join(','));
    }

    // 任务状态
    if (searchParams.taskStatus && searchParams.taskStatus.length > 0) {
      queryParams.set('taskStatus', searchParams.taskStatus.join(','));
    }

    // 任务类型
    if (searchParams.taskType && searchParams.taskType.length > 0) {
      queryParams.set('taskType', searchParams.taskType.join(','));
    }

    // 优先级
    if (searchParams.priority && searchParams.priority.length > 0) {
      queryParams.set('priority', searchParams.priority.join(','));
    }

    // 标签ID
    if (searchParams.tagIds && searchParams.tagIds.length > 0) {
      queryParams.set('tagIds', searchParams.tagIds.join(','));
    }

    // 标签类型
    if (searchParams.tagTypes && searchParams.tagTypes.length > 0) {
      queryParams.set('tagTypes', searchParams.tagTypes.join(','));
    }

    // 项目ID
    if (searchParams.projectIds && searchParams.projectIds.length > 0) {
      queryParams.set('projectIds', searchParams.projectIds.join(','));
    }

    // 日期筛选
    if (searchParams.createdAfter) {
      queryParams.set('createdAfter', searchParams.createdAfter);
    }
    if (searchParams.createdBefore) {
      queryParams.set('createdBefore', searchParams.createdBefore);
    }
    if (searchParams.updatedAfter) {
      queryParams.set('updatedAfter', searchParams.updatedAfter);
    }
    if (searchParams.updatedBefore) {
      queryParams.set('updatedBefore', searchParams.updatedBefore);
    }
    if (searchParams.dueAfter) {
      queryParams.set('dueAfter', searchParams.dueAfter);
    }
    if (searchParams.dueBefore) {
      queryParams.set('dueBefore', searchParams.dueBefore);
    }

    // 状态筛选
    if (searchParams.isCompleted !== undefined && searchParams.isCompleted !== null) {
      queryParams.set('isCompleted', searchParams.isCompleted.toString());
    }
    if (searchParams.isOverdue !== undefined && searchParams.isOverdue !== null) {
      queryParams.set('isOverdue', searchParams.isOverdue.toString());
    }
    if (searchParams.isRecurring !== undefined && searchParams.isRecurring !== null) {
      queryParams.set('isRecurring', searchParams.isRecurring.toString());
    }
    if (searchParams.hasDescription !== undefined && searchParams.hasDescription !== null) {
      queryParams.set('hasDescription', searchParams.hasDescription.toString());
    }

    // 时间追踪
    if (searchParams.hasTimeTracking !== undefined && searchParams.hasTimeTracking !== null) {
      queryParams.set('hasTimeTracking', searchParams.hasTimeTracking.toString());
    }
    if (searchParams.minTimeSpent !== undefined && searchParams.minTimeSpent !== null) {
      queryParams.set('minTimeSpent', searchParams.minTimeSpent.toString());
    }
    if (searchParams.maxTimeSpent !== undefined && searchParams.maxTimeSpent !== null) {
      queryParams.set('maxTimeSpent', searchParams.maxTimeSpent.toString());
    }

    // 排序
    if (searchParams.sortBy) {
      queryParams.set('sortBy', searchParams.sortBy);
    }
    if (searchParams.sortOrder) {
      queryParams.set('sortOrder', searchParams.sortOrder);
    }

    // 添加编辑标识和搜索信息
    queryParams.set('editingSearchId', search.id);
    queryParams.set('editingSearchName', search.name);
    if (search.description) {
      queryParams.set('editingSearchDescription', search.description);
    }

    // 跳转到复合搜索页面
    void router.push(`/search?${queryParams.toString()}`);
  }, [router]);

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
          <title>搜索列表 | Infer GTD</title>
          <meta name="description" content="管理保存的搜索" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题 */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">搜索列表</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              管理您保存的搜索条件，快速重复使用常用搜索 • {filteredSearches.length} 个搜索
            </p>
          </div>

          {/* 搜索和筛选 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
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

          {/* 搜索结果 */}
          {isLoading || isLoadingTags || isLoadingProjects ? (
            <SectionLoading />
          ) : filteredSearches.length > 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-medium text-gray-900">搜索列表</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? `找到 ${filteredSearches.length} 个匹配的搜索` : `共 ${filteredSearches.length} 个保存的搜索`}
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredSearches.map((search) => (
                    <SavedSearchCard
                      key={search.id}
                      search={search}
                      onLoad={handleLoadSavedSearch}
                      onEdit={handleOpenSaveModal}
                      onEditConditions={handleEditSearchConditions}
                      onDelete={handleDeleteSavedSearch}
                      generateSearchSummary={generateSearchSummary}
                      generateSearchConditions={generateSearchConditions}
                      tags={tags?.tags || []}
                      projects={projects?.projects || []}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white">
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

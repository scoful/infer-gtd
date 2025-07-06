import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  AdjustmentsHorizontalIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  DocumentTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Priority, TaskStatus, type TaskType } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { SectionLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import SearchResultItem from "@/components/Search/SearchResultItem";
import SearchFilters from "@/components/Search/SearchFilters";
import TaskModal from "@/components/Tasks/TaskModal";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { useConfirm } from "@/hooks";
import SavedSearchModal, { type SavedSearchFormData } from "@/components/Search/SavedSearchModal";


// 搜索结果类型
interface SearchResults {
  tasks: any[];
  notes: any[];
  projects: any[];
  journals: any[];
  totalCount: number;
  nextCursor?: string;
}

const SearchPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const { showConfirm } = useConfirm();

  // 基础搜索状态
  const [query, setQuery] = useState("");
  const [searchIn, setSearchIn] = useState<string[]>(["tasks", "notes", "projects", "journals"]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 高级搜索状态
  const [taskStatus, setTaskStatus] = useState<TaskStatus[]>([]);
  const [taskType, setTaskType] = useState<TaskType[]>([]);
  const [priority, setPriority] = useState<Priority[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);

  // 日期筛选
  const [createdAfter, setCreatedAfter] = useState<Date | null>(null);
  const [createdBefore, setCreatedBefore] = useState<Date | null>(null);
  const [dueAfter, setDueAfter] = useState<Date | null>(null);
  const [dueBefore, setDueBefore] = useState<Date | null>(null);

  // 状态筛选
  const [isCompleted, setIsCompleted] = useState<boolean | null>(null);
  const [isOverdue, setIsOverdue] = useState<boolean | null>(null);
  const [hasDescription, setHasDescription] = useState<boolean | null>(null);

  // 排序
  const [sortBy, setSortBy] = useState<string>("relevance");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");



  // 任务编辑模态框状态
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // 保存搜索
  const [isSaveSearchModalOpen, setIsSaveSearchModalOpen] = useState(false);

  // 分页状态
  const [displayLimit, setDisplayLimit] = useState(20);
  const pageSize = 20;

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = useCallback(() => {
    return (
      taskStatus.length > 0 ||
      taskType.length > 0 ||
      priority.length > 0 ||
      tagIds.length > 0 ||
      projectIds.length > 0 ||
      createdAfter !== null ||
      createdBefore !== null ||
      dueAfter !== null ||
      dueBefore !== null ||
      isCompleted !== null ||
      isOverdue !== null ||
      hasDescription !== null
    );
  }, [
    taskStatus,
    taskType,
    priority,
    tagIds,
    projectIds,
    createdAfter,
    createdBefore,
    dueAfter,
    dueBefore,
    isCompleted,
    isOverdue,
    hasDescription,
  ]);

  // 构建搜索参数
  const searchParams = useMemo(() => {
    const params: any = {
      query: query.trim() || undefined,
      searchIn,
      sortBy,
      sortOrder,
      limit: displayLimit,
    };

    if (taskStatus.length > 0) params.taskStatus = taskStatus;
    if (taskType.length > 0) params.taskType = taskType;
    if (priority.length > 0) params.priority = priority;
    if (tagIds.length > 0) params.tagIds = tagIds;
    if (projectIds.length > 0) params.projectIds = projectIds;
    if (createdAfter) params.createdAfter = createdAfter;
    if (createdBefore) params.createdBefore = createdBefore;
    if (dueAfter) params.dueAfter = dueAfter;
    if (dueBefore) params.dueBefore = dueBefore;
    if (isCompleted !== null) params.isCompleted = isCompleted;
    if (isOverdue !== null) params.isOverdue = isOverdue;
    if (hasDescription !== null) params.hasDescription = hasDescription;

    return params;
  }, [
    query,
    searchIn,
    taskStatus,
    taskType,
    priority,
    tagIds,
    projectIds,
    createdAfter,
    createdBefore,
    dueAfter,
    dueBefore,
    isCompleted,
    isOverdue,
    hasDescription,
    sortBy,
    sortOrder,
    displayLimit,
  ]);

  // 执行搜索
  const {
    data: searchResults,
    isLoading,
    isFetching,
    refetch,
  } = api.search.advanced.useQuery(searchParams, {
    enabled:
      !!sessionData && (
        !!query.trim() ||
        hasActiveFilters() ||
        searchIn.length !== 4 // 当搜索范围不是默认的全部四种类型时，也启用搜索
      ),
    staleTime: 30 * 1000,
  });

  // 获取标签和项目用于筛选
  const { data: tags, refetch: refetchTags } = api.tag.getAll.useQuery(
    { limit: 100 },
    { enabled: !!sessionData },
  );

  const { data: projects, refetch: refetchProjects } =
    api.project.getAll.useQuery({ limit: 100 }, { enabled: !!sessionData });





  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetch(),
      refetchTags(),
      refetchProjects(),
    ]);
  }, [refetch, refetchTags, refetchProjects]);

  // 保存搜索
  const saveSearchMutation = api.search.saveSearch.useMutation({
    onSuccess: (data) => {
      showSuccess(`搜索 "${data.name}" 保存成功`);
      setIsSaveSearchModalOpen(false);
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        showError("搜索名称已存在，请使用其他名称");
      } else {
        showError(error.message || "保存搜索失败");
      }
    },
  });







  // 处理搜索
  const handleSearch = useCallback(() => {
    void refetch();
  }, [refetch]);

  // 处理任务点击
  const handleTaskClick = useCallback((task: any) => {
    setEditingTaskId(task.id);
    setIsTaskModalOpen(true);
  }, []);

  // 处理任务模态框关闭
  const handleTaskModalClose = useCallback(() => {
    setIsTaskModalOpen(false);
    setEditingTaskId(null);
  }, []);

  // 处理任务模态框成功
  const handleTaskModalSuccess = useCallback(() => {
    void refetch();
    handleTaskModalClose();
  }, [refetch, handleTaskModalClose]);

  // 计算结果信息
  const totalResults = searchResults?.totalCount || 0;
  const hasResults = totalResults > 0;

  // 检查是否可以加载更多（当前显示的结果数量达到限制且可能还有更多）
  const canLoadMore = searchResults && (
    (searchResults.tasks?.length || 0) +
    (searchResults.notes?.length || 0) +
    (searchResults.projects?.length || 0) +
    (searchResults.journals?.length || 0)
  ) >= displayLimit && displayLimit < 100; // 最多显示100条

  // 加载更多处理
  const handleLoadMore = useCallback(() => {
    setDisplayLimit(prev => Math.min(prev + pageSize, 100));
  }, [pageSize]);

  // 当搜索条件改变时重置显示限制
  useEffect(() => {
    setDisplayLimit(pageSize);
  }, [
    query,
    searchIn,
    taskStatus,
    taskType,
    priority,
    tagIds,
    projectIds,
    createdAfter,
    createdBefore,
    dueAfter,
    dueBefore,
    isCompleted,
    isOverdue,
    hasDescription,
    sortBy,
    sortOrder,
    pageSize,
  ]);



  // 计算活跃筛选条件数量
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    // 基础筛选条件
    if (taskStatus.length > 0) count++;
    if (taskType.length > 0) count++;
    if (priority.length > 0) count++;
    if (tagIds.length > 0) count++;
    if (projectIds.length > 0) count++;
    if (createdAfter !== null) count++;
    if (createdBefore !== null) count++;
    if (dueAfter !== null) count++;
    if (dueBefore !== null) count++;
    if (isCompleted !== null) count++;
    if (isOverdue !== null) count++;
    if (hasDescription !== null) count++;

    // 搜索范围筛选（当不是默认的全部四种类型时）
    if (searchIn.length !== 4 || !searchIn.includes("tasks") || !searchIn.includes("notes") || !searchIn.includes("projects") || !searchIn.includes("journals")) {
      count++;
    }

    // 排序方式筛选（当不是默认排序时）
    if (sortBy !== "relevance" || sortOrder !== "desc") {
      count++;
    }

    return count;
  }, [
    taskStatus,
    taskType,
    priority,
    tagIds,
    projectIds,
    createdAfter,
    createdBefore,
    dueAfter,
    dueBefore,
    isCompleted,
    isOverdue,
    hasDescription,
    searchIn,
    sortBy,
    sortOrder,
  ]);

  // 处理URL参数（只在路由准备好且参数变化时执行）
  useEffect(() => {
    if (!router.isReady) return;

    // 先清除所有筛选条件，避免累加
    setTaskStatus([]);
    setTaskType([]);
    setPriority([]);
    setTagIds([]);
    setProjectIds([]);
    setCreatedAfter(null);
    setCreatedBefore(null);
    setDueAfter(null);
    setDueBefore(null);
    setIsCompleted(null);
    setIsOverdue(null);
    setHasDescription(null);

    // 处理查询词
    const urlQuery = router.query.q as string;
    if (urlQuery) {
      setQuery(urlQuery);
    } else {
      setQuery('');
    }

    // 解析智能搜索参数
    const { searchIn: urlSearchIn, priority: urlPriority, status: urlStatus,
            createdAfter: urlCreatedAfter, sortBy: urlSortBy, sortOrder: urlSortOrder,
            searchBy: urlSearchBy } = router.query;

    // 重置搜索范围为默认值，然后应用URL参数
    if (urlSearchIn && typeof urlSearchIn === 'string') {
      const searchInArray = urlSearchIn.split(',');
      setSearchIn(searchInArray);
    } else {
      setSearchIn(["tasks", "notes", "projects", "journals"]);
    }

    if (urlPriority && typeof urlPriority === 'string') {
      const priorityArray = urlPriority.split(',') as Priority[];
      setPriority(priorityArray);
    }

    if (urlStatus && typeof urlStatus === 'string') {
      const statusArray = urlStatus.split(',') as TaskStatus[];
      setTaskStatus(statusArray);
    }

    if (urlCreatedAfter && typeof urlCreatedAfter === 'string') {
      setCreatedAfter(new Date(urlCreatedAfter));
    }

    if (urlSortBy && typeof urlSortBy === 'string') {
      setSortBy(urlSortBy);
    } else {
      setSortBy("relevance");
    }

    if (urlSortOrder && typeof urlSortOrder === 'string') {
      setSortOrder(urlSortOrder as "asc" | "desc");
    } else {
      setSortOrder("desc");
    }

    // 处理标签搜索（需要等待标签数据加载）
    if (urlSearchBy === 'tag' && urlQuery && tags?.tags) {
      const matchingTag = tags.tags.find(tag =>
        tag.name.toLowerCase() === urlQuery.toLowerCase()
      );
      if (matchingTag) {
        setTagIds([matchingTag.id]);
        setQuery(''); // 清空查询词，使用标签筛选
      }
    }
  }, [router.isReady, router.query, tags?.tags]);

  // 清空筛选
  const clearFilters = useCallback(() => {
    setTaskStatus([]);
    setTaskType([]);
    setPriority([]);
    setTagIds([]);
    setProjectIds([]);
    setCreatedAfter(null);
    setCreatedBefore(null);
    setDueAfter(null);
    setDueBefore(null);
    setIsCompleted(null);
    setIsOverdue(null);
    setHasDescription(null);
    // 重置搜索范围和排序方式
    setSearchIn(["tasks", "notes", "projects", "journals"]);
    setSortBy("relevance");
    setSortOrder("desc");
  }, []);



  // 保存当前搜索
  const handleSaveCurrentSearch = useCallback((formData: SavedSearchFormData) => {
    console.log("保存搜索参数:", searchParams);
    saveSearchMutation.mutate({
      ...formData,
      searchParams,
    });
  }, [saveSearchMutation, searchParams]);

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

    if (searchParams.taskType && searchParams.taskType.length > 0) {
      const typeMap: Record<string, string> = {
        SINGLE: "单次任务",
        RECURRING: "重复任务"
      };
      const types = searchParams.taskType.map((type: string) => typeMap[type] || type);
      conditions.push(`任务类型: ${types.join("、")}`);
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

    // 时间筛选
    if (searchParams.createdAfter || searchParams.createdBefore) {
      console.log("时间参数调试:", {
        createdAfter: searchParams.createdAfter,
        createdBefore: searchParams.createdBefore,
        createdAfterType: typeof searchParams.createdAfter,
        createdBeforeType: typeof searchParams.createdBefore
      });

      const formatDate = (dateValue: any) => {
        try {
          if (!dateValue) return null;
          // 处理Date对象、ISO字符串、或其他格式
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return String(dateValue);
          return date.toLocaleDateString("zh-CN");
        } catch {
          return String(dateValue);
        }
      };

      const formattedAfter = formatDate(searchParams.createdAfter);
      const formattedBefore = formatDate(searchParams.createdBefore);

      if (formattedAfter && formattedBefore) {
        conditions.push(`创建时间: ${formattedAfter} 至 ${formattedBefore}`);
      } else if (formattedAfter) {
        conditions.push(`创建时间: ${formattedAfter} 之后`);
      } else if (formattedBefore) {
        conditions.push(`创建时间: ${formattedBefore} 之前`);
      }
    }



    if (searchParams.dueAfter || searchParams.dueBefore) {
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

      const formattedAfter = formatDate(searchParams.dueAfter);
      const formattedBefore = formatDate(searchParams.dueBefore);

      if (formattedAfter && formattedBefore) {
        conditions.push(`截止时间: ${formattedAfter} 至 ${formattedBefore}`);
      } else if (formattedAfter) {
        conditions.push(`截止时间: ${formattedAfter} 之后`);
      } else if (formattedBefore) {
        conditions.push(`截止时间: ${formattedBefore} 之前`);
      }
    }



    // 状态筛选
    if (searchParams.isCompleted !== undefined) {
      conditions.push(`完成状态: ${searchParams.isCompleted ? "已完成" : "未完成"}`);
    }

    if (searchParams.isOverdue !== undefined) {
      conditions.push(`逾期状态: ${searchParams.isOverdue ? "已逾期" : "未逾期"}`);
    }



    if (searchParams.hasDescription !== undefined) {
      conditions.push(`描述: ${searchParams.hasDescription ? "有" : "无"}`);
    }

    // 排序
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





  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>高级搜索 | Infer GTD</title>
          <meta name="description" content="高级搜索和筛选功能" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">高级搜索</h1>
                {isFetching && !isLoading && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium ${
                  showAdvanced || activeFiltersCount > 0
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AdjustmentsHorizontalIcon className="mr-2 h-4 w-4" />
                高级筛选
                {activeFiltersCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索任务、笔记、项目、日记... "
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="block w-full rounded-md border border-gray-300 py-3 pr-3 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {isLoading ? "搜索中..." : "搜索"}
              </button>
            </div>

            {/* 活跃筛选条件摘要 */}
            {activeFiltersCount > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    已启用 {activeFiltersCount} 个筛选条件
                  </span>
                  <button
                    onClick={clearFilters}
                    className="self-start text-sm text-blue-600 hover:text-blue-800 sm:self-auto"
                  >
                    清除所有筛选
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* 标签筛选 */}
                  {tagIds.length > 0 && tagIds.map((tagId) => {
                    const tag = tags?.tags?.find(t => t.id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        #{tag.name}
                        <button
                          onClick={() => setTagIds(tagIds.filter(id => id !== tagId))}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}

                  {/* 任务状态筛选 */}
                  {taskStatus.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                      状态: {taskStatus.map(status => {
                        const statusLabels = {
                          'IDEA': '想法',
                          'TODO': '待办',
                          'IN_PROGRESS': '进行中',
                          'DONE': '已完成',
                          'CANCELLED': '已取消'
                        };
                        return statusLabels[status as keyof typeof statusLabels] || status;
                      }).join(', ')}
                      <button
                        onClick={() => setTaskStatus([])}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 优先级筛选 */}
                  {priority.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                      优先级: {priority.map(p => {
                        const priorityLabels = {
                          'LOW': '低',
                          'MEDIUM': '中',
                          'HIGH': '高',
                          'URGENT': '紧急'
                        };
                        return priorityLabels[p as keyof typeof priorityLabels] || p;
                      }).join(', ')}
                      <button
                        onClick={() => setPriority([])}
                        className="ml-1 text-orange-600 hover:text-orange-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 项目筛选 */}
                  {projectIds.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
                      项目: {(() => {
                        if (!projects?.projects) return `${projectIds.length} 个`;
                        const selectedProjects = projects.projects.filter(p => projectIds.includes(p.id));
                        if (selectedProjects.length <= 2) {
                          return selectedProjects.map(p => p.name).join(', ');
                        } else {
                          return `${selectedProjects[0]?.name} 等 ${selectedProjects.length} 个`;
                        }
                      })()}
                      <button
                        onClick={() => setProjectIds([])}
                        className="ml-1 text-purple-600 hover:text-purple-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 创建日期筛选 */}
                  {(createdAfter || createdBefore) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">
                      创建日期: {(() => {
                        if (createdAfter && createdBefore) {
                          return `${createdAfter.toLocaleDateString()} - ${createdBefore.toLocaleDateString()}`;
                        } else if (createdAfter) {
                          return `≥ ${createdAfter.toLocaleDateString()}`;
                        } else if (createdBefore) {
                          return `≤ ${createdBefore.toLocaleDateString()}`;
                        }
                        return '日期筛选';
                      })()}
                      <button
                        onClick={() => {
                          setCreatedAfter(null);
                          setCreatedBefore(null);
                        }}
                        className="ml-1 text-gray-600 hover:text-gray-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 截止日期筛选 */}
                  {(dueAfter || dueBefore) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
                      截止日期: {(() => {
                        if (dueAfter && dueBefore) {
                          return `${dueAfter.toLocaleDateString()} - ${dueBefore.toLocaleDateString()}`;
                        } else if (dueAfter) {
                          return `≥ ${dueAfter.toLocaleDateString()}`;
                        } else if (dueBefore) {
                          return `≤ ${dueBefore.toLocaleDateString()}`;
                        }
                        return '截止日期筛选';
                      })()}
                      <button
                        onClick={() => {
                          setDueAfter(null);
                          setDueBefore(null);
                        }}
                        className="ml-1 text-yellow-600 hover:text-yellow-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 任务类型筛选 */}
                  {taskType.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-3 py-1 text-sm text-cyan-800">
                      类型: {taskType.map(type => {
                        const typeLabels = {
                          'TASK': '任务',
                          'MILESTONE': '里程碑',
                          'BUG': '缺陷',
                          'FEATURE': '功能'
                        };
                        return typeLabels[type as keyof typeof typeLabels] || type;
                      }).join(', ')}
                      <button
                        onClick={() => setTaskType([])}
                        className="ml-1 text-cyan-600 hover:text-cyan-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 完成状态筛选 */}
                  {isCompleted !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-800">
                      {isCompleted ? '已完成' : '未完成'}
                      <button
                        onClick={() => setIsCompleted(null)}
                        className="ml-1 text-indigo-600 hover:text-indigo-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 逾期状态筛选 */}
                  {isOverdue !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-800">
                      {isOverdue ? '已逾期' : '未逾期'}
                      <button
                        onClick={() => setIsOverdue(null)}
                        className="ml-1 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 描述筛选 */}
                  {hasDescription !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-sm text-teal-800">
                      {hasDescription ? '有描述' : '无描述'}
                      <button
                        onClick={() => setHasDescription(null)}
                        className="ml-1 text-teal-600 hover:text-teal-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 搜索范围筛选 */}
                  {(searchIn.length !== 4 || !searchIn.includes("tasks") || !searchIn.includes("notes") || !searchIn.includes("projects") || !searchIn.includes("journals")) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800">
                      搜索范围: {(() => {
                        const typeLabels = {
                          'tasks': '任务',
                          'notes': '笔记',
                          'projects': '项目',
                          'journals': '日记'
                        };
                        return searchIn.map(type => typeLabels[type as keyof typeof typeLabels] || type).join(', ');
                      })()}
                      <button
                        onClick={() => setSearchIn(["tasks", "notes", "projects", "journals"])}
                        className="ml-1 text-slate-600 hover:text-slate-800"
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {/* 排序方式筛选 */}
                  {(sortBy !== "relevance" || sortOrder !== "desc") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">
                      排序: {(() => {
                        const sortLabels = {
                          'relevance': '相关性',
                          'createdAt': '创建时间',
                          'updatedAt': '更新时间',
                          'title': '标题',
                          'priority': '优先级',
                          'dueDate': '截止日期'
                        };
                        const orderLabels = {
                          'asc': '升序',
                          'desc': '降序'
                        };
                        const sortLabel = sortLabels[sortBy as keyof typeof sortLabels] || sortBy;
                        const orderLabel = orderLabels[sortOrder as keyof typeof orderLabels] || sortOrder;
                        return `${sortLabel} ${orderLabel}`;
                      })()}
                      <button
                        onClick={() => {
                          setSortBy("relevance");
                          setSortOrder("desc");
                        }}
                        className="ml-1 text-emerald-600 hover:text-emerald-800"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 搜索范围 */}
            <div className="mt-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <label className="text-sm font-medium text-gray-700">
                  搜索范围
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchIn(["tasks", "notes", "projects", "journals"])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    全选
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    onClick={() => setSearchIn([])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    不选
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-2">
                {[
                  { value: "tasks", label: "任务", icon: CheckIcon },
                  { value: "notes", label: "笔记", icon: DocumentTextIcon },
                  { value: "projects", label: "项目", icon: FolderIcon },
                  { value: "journals", label: "日记", icon: CalendarIcon },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={searchIn.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSearchIn([...searchIn, option.value]);
                          } else {
                            setSearchIn(
                              searchIn.filter((item) => item !== option.value),
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 flex items-center text-sm text-gray-700">
                        <Icon className="mr-1 h-4 w-4" />
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>



          {/* 高级筛选面板 */}
          {showAdvanced && (
            <AdvancedFilters
              taskStatus={taskStatus}
              setTaskStatus={setTaskStatus}
              taskType={taskType}
              setTaskType={setTaskType}
              priority={priority}
              setPriority={setPriority}
              tagIds={tagIds}
              setTagIds={setTagIds}
              projectIds={projectIds}
              setProjectIds={setProjectIds}
              createdAfter={createdAfter}
              setCreatedAfter={setCreatedAfter}
              createdBefore={createdBefore}
              setCreatedBefore={setCreatedBefore}
              dueAfter={dueAfter}
              setDueAfter={setDueAfter}
              dueBefore={dueBefore}
              setDueBefore={setDueBefore}
              isCompleted={isCompleted}
              setIsCompleted={setIsCompleted}
              isOverdue={isOverdue}
              setIsOverdue={setIsOverdue}
              hasDescription={hasDescription}
              setHasDescription={setHasDescription}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              tags={tags?.tags ?? []}
              projects={projects?.projects ?? []}
              onClear={clearFilters}
            />
          )}

          {/* 搜索结果 */}
          <div className="space-y-4">
            {/* 搜索结果标题和保存按钮 */}
            {(searchResults || isLoading) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-gray-900">搜索结果</h2>
                  {searchResults && (
                    <span className="text-sm text-gray-500">
                      共找到 {
                        (searchResults.tasks?.length || 0) +
                        (searchResults.notes?.length || 0) +
                        (searchResults.projects?.length || 0) +
                        (searchResults.journals?.length || 0)
                      } 条结果
                    </span>
                  )}
                </div>

                {/* 保存搜索按钮 */}
                {searchResults && (
                  <button
                    onClick={() => setIsSaveSearchModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <BookmarkIcon className="h-4 w-4" />
                    保存搜索
                  </button>
                )}
              </div>
            )}

            <SearchResults
              results={searchResults}
              isLoading={isLoading}
              query={query}
              searchIn={searchIn}
              onTaskClick={handleTaskClick}
            />
          </div>

          {/* 加载更多按钮 */}
          {hasResults && canLoadMore && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  className="w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
                >
                  {isFetching ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent"></div>
                      加载中...
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">加载更多</span>
                      <span className="hidden sm:inline">{`加载更多 (当前显示 ${displayLimit} 条)`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 任务编辑模态框 */}
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleTaskModalClose}
          taskId={editingTaskId ?? undefined}
          onSuccess={handleTaskModalSuccess}
        />

        {/* 保存搜索模态框 */}
        <SavedSearchModal
          isOpen={isSaveSearchModalOpen}
          onClose={() => setIsSaveSearchModalOpen(false)}
          onSave={handleSaveCurrentSearch}
          mode="create"
          isLoading={saveSearchMutation.isPending}
        />

      </MainLayout>
    </AuthGuard>
  );
};

// 高级筛选组件
interface AdvancedFiltersProps {
  taskStatus: TaskStatus[];
  setTaskStatus: (status: TaskStatus[]) => void;
  taskType: TaskType[];
  setTaskType: (type: TaskType[]) => void;
  priority: Priority[];
  setPriority: (priority: Priority[]) => void;
  tagIds: string[];
  setTagIds: (ids: string[]) => void;
  projectIds: string[];
  setProjectIds: (ids: string[]) => void;
  createdAfter: Date | null;
  setCreatedAfter: (date: Date | null) => void;
  createdBefore: Date | null;
  setCreatedBefore: (date: Date | null) => void;
  dueAfter: Date | null;
  setDueAfter: (date: Date | null) => void;
  dueBefore: Date | null;
  setDueBefore: (date: Date | null) => void;
  isCompleted: boolean | null;
  setIsCompleted: (completed: boolean | null) => void;
  isOverdue: boolean | null;
  setIsOverdue: (overdue: boolean | null) => void;
  hasDescription: boolean | null;
  setHasDescription: (hasDesc: boolean | null) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (order: "asc" | "desc") => void;
  tags: any[];
  projects: any[];
  onClear: () => void;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  taskStatus,
  setTaskStatus,
  taskType: _taskType,
  setTaskType: _setTaskType,
  priority,
  setPriority,
  tagIds,
  setTagIds,
  projectIds,
  setProjectIds,
  createdAfter,
  setCreatedAfter,
  createdBefore,
  setCreatedBefore,
  dueAfter: _dueAfter,
  setDueAfter: _setDueAfter,
  dueBefore: _dueBefore,
  setDueBefore: _setDueBefore,
  isCompleted,
  setIsCompleted,
  isOverdue,
  setIsOverdue,
  hasDescription,
  setHasDescription,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  tags,
  projects,
  onClear,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium text-gray-900">高级筛选</h3>
        <button
          onClick={onClear}
          className="self-start text-sm text-gray-500 hover:text-gray-700 sm:self-auto"
        >
          清空筛选
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* 任务状态 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            任务状态
          </label>
          <div className="space-y-2">
            {Object.values(TaskStatus).map((status) => (
              <label key={status} className="flex items-center">
                <input
                  type="checkbox"
                  checked={taskStatus.includes(status)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTaskStatus([...taskStatus, status]);
                    } else {
                      setTaskStatus(taskStatus.filter((s) => s !== status));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {getStatusLabel(status)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 优先级 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            优先级
          </label>
          <div className="space-y-2">
            {Object.values(Priority).map((p) => (
              <label key={p} className="flex items-center">
                <input
                  type="checkbox"
                  checked={priority.includes(p)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPriority([...priority, p]);
                    } else {
                      setPriority(priority.filter((pr) => pr !== p));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {getPriorityLabel(p)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 标签 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            标签
          </label>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={tagIds.includes(tag.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTagIds([...tagIds, tag.id]);
                    } else {
                      setTagIds(tagIds.filter((id) => id !== tag.id));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 flex items-center text-sm text-gray-700">
                  {tag.icon && <span className="mr-1">{tag.icon}</span>}
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 项目 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            项目
          </label>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {projects.map((project) => (
              <label key={project.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setProjectIds([...projectIds, project.id]);
                    } else {
                      setProjectIds(
                        projectIds.filter((id) => id !== project.id),
                      );
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {project.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 日期筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            创建日期
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={
                createdAfter ? createdAfter.toISOString().split("T")[0] : ""
              }
              onChange={(e) =>
                setCreatedAfter(
                  e.target.value ? new Date(e.target.value) : null,
                )
              }
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="开始日期"
            />
            <input
              type="date"
              value={
                createdBefore ? createdBefore.toISOString().split("T")[0] : ""
              }
              onChange={(e) =>
                setCreatedBefore(
                  e.target.value ? new Date(e.target.value) : null,
                )
              }
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="结束日期"
            />
          </div>
        </div>

        {/* 状态筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            状态筛选
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isCompleted === true}
                onChange={(e) => setIsCompleted(e.target.checked ? true : null)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">已完成</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isOverdue === true}
                onChange={(e) => setIsOverdue(e.target.checked ? true : null)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">已逾期</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasDescription === true}
                onChange={(e) =>
                  setHasDescription(e.target.checked ? true : null)
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">有描述</span>
            </label>
          </div>
        </div>
      </div>

      {/* 排序 */}
      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              排序方式
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="relevance">相关性</option>
              <option value="createdAt">创建时间</option>
              <option value="updatedAt">更新时间</option>
              <option value="dueDate">截止日期</option>
              <option value="priority">优先级</option>
              <option value="title">标题</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              排序顺序
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// 搜索结果组件
interface SearchResultsProps {
  results?: SearchResults;
  isLoading: boolean;
  query: string;
  searchIn: string[];
  onTaskClick?: (task: any) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  query,
  searchIn,
  onTaskClick,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionLoading />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-center text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">开始搜索</h3>
          <p className="mt-1 text-sm text-gray-500">
            输入关键词或设置筛选条件来搜索内容
          </p>
        </div>
      </div>
    );
  }

  const { tasks, notes, projects, journals, totalCount } = results;

  if (totalCount === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-center text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">未找到结果</h3>
          <p className="mt-1 text-sm text-gray-500">尝试调整搜索条件或筛选器</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 结果统计 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">
          找到 <span className="font-medium text-gray-900">{totalCount}</span>{" "}
          个结果
          {query && (
            <>
              ，关键词:{" "}
              <span className="font-medium text-gray-900">
                &ldquo;{query}&rdquo;
              </span>
            </>
          )}
        </p>
      </div>

      {/* 任务结果 */}
      {searchIn.includes("tasks") && tasks.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
            <CheckIcon className="mr-2 h-5 w-5" />
            任务 ({tasks.length})
          </h3>
          <div className="space-y-3">
            {tasks.map((task) => (
              <SearchResultItem
                key={task.id}
                type="task"
                item={task}
                query={query}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 笔记结果 */}
      {searchIn.includes("notes") && notes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
            <DocumentTextIcon className="mr-2 h-5 w-5" />
            笔记 ({notes.length})
          </h3>
          <div className="space-y-3">
            {notes.map((note) => (
              <SearchResultItem
                key={note.id}
                type="note"
                item={note}
                query={query}
              />
            ))}
          </div>
        </div>
      )}

      {/* 项目结果 */}
      {searchIn.includes("projects") && projects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
            <FolderIcon className="mr-2 h-5 w-5" />
            项目 ({projects.length})
          </h3>
          <div className="space-y-3">
            {projects.map((project) => (
              <SearchResultItem
                key={project.id}
                type="project"
                item={project}
                query={query}
              />
            ))}
          </div>
        </div>
      )}

      {/* 日记结果 */}
      {searchIn.includes("journals") && journals.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
            <CalendarIcon className="mr-2 h-5 w-5" />
            日记 ({journals.length})
          </h3>
          <div className="space-y-3">
            {journals.map((journal) => (
              <SearchResultItem
                key={journal.id}
                type="journal"
                item={{
                  ...journal,
                  title: new Date(journal.date).toLocaleDateString("zh-CN", {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                }}
                query={query}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 辅助函数
function getStatusLabel(status: TaskStatus): string {
  const labels = {
    [TaskStatus.IDEA]: "想法",
    [TaskStatus.TODO]: "待办",
    [TaskStatus.IN_PROGRESS]: "进行中",
    [TaskStatus.WAITING]: "等待",
    [TaskStatus.DONE]: "完成",
    [TaskStatus.ARCHIVED]: "归档",
  };
  return labels[status];
}

function getPriorityLabel(priority: Priority): string {
  const labels = {
    [Priority.LOW]: "低",
    [Priority.MEDIUM]: "中",
    [Priority.HIGH]: "高",
    [Priority.URGENT]: "紧急",
  };
  return labels[priority];
}

function getStatusColor(status: TaskStatus): string {
  const colors = {
    [TaskStatus.IDEA]: "bg-gray-100 text-gray-800",
    [TaskStatus.TODO]: "bg-blue-100 text-blue-800",
    [TaskStatus.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
    [TaskStatus.WAITING]: "bg-orange-100 text-orange-800",
    [TaskStatus.DONE]: "bg-green-100 text-green-800",
    [TaskStatus.ARCHIVED]: "bg-orange-100 text-orange-700",
  };
  return colors[status];
}

function getPriorityColor(priority: Priority): string {
  const colors = {
    [Priority.LOW]: "bg-green-100 text-green-800",
    [Priority.MEDIUM]: "bg-yellow-100 text-yellow-800",
    [Priority.HIGH]: "bg-orange-100 text-orange-800",
    [Priority.URGENT]: "bg-red-100 text-red-800",
  };
  return colors[priority];
}

export default SearchPage;

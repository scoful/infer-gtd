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
} from "@heroicons/react/24/outline";
import { Priority, TaskStatus, type TaskType } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { SectionLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import SearchResultItem from "@/components/Search/SearchResultItem";
import SearchFilters from "@/components/Search/SearchFilters";

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

  // 保存的搜索
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  // 构建搜索参数
  const searchParams = useMemo(() => {
    const params: any = {
      query: query.trim() || undefined,
      searchIn,
      sortBy,
      sortOrder,
      limit: 20,
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
  ]);

  // 执行搜索
  const {
    data: searchResults,
    isLoading,
    isFetching,
    refetch,
  } = api.search.advanced.useQuery(searchParams, {
    enabled:
      !!sessionData && (!!query.trim() || Object.keys(searchParams).length > 4),
    staleTime: 30 * 1000,
  });

  // 获取标签和项目用于筛选
  const { data: tags, refetch: refetchTags } = api.tag.getAll.useQuery(
    { limit: 100 },
    { enabled: !!sessionData },
  );

  const { data: projects, refetch: refetchProjects } =
    api.project.getAll.useQuery({ limit: 100 }, { enabled: !!sessionData });

  // 获取保存的搜索
  const { data: savedSearches, refetch: refetchSavedSearches } =
    api.search.getSavedSearches.useQuery(undefined, { enabled: !!sessionData });

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetch(),
      refetchTags(),
      refetchProjects(),
      refetchSavedSearches(),
    ]);
  }, [refetch, refetchTags, refetchProjects, refetchSavedSearches]);

  // 保存搜索
  const saveSearchMutation = api.search.saveSearch.useMutation({
    onSuccess: () => {
      setSaveSearchName("");
      // 刷新保存的搜索列表
    },
  });

  // 处理搜索
  const handleSearch = useCallback(() => {
    void refetch();
  }, [refetch]);

  // 处理URL参数
  useEffect(() => {
    const urlQuery = router.query.q as string;
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
    }

    // 解析智能搜索参数
    const { searchIn: urlSearchIn, priority: urlPriority, status: urlStatus,
            createdAfter: urlCreatedAfter, sortBy: urlSortBy, sortOrder: urlSortOrder } = router.query;

    if (urlSearchIn && typeof urlSearchIn === 'string') {
      const searchInArray = urlSearchIn.split(',');
      setSearchIn(searchInArray);
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
    }

    if (urlSortOrder && typeof urlSortOrder === 'string') {
      setSortOrder(urlSortOrder as "asc" | "desc");
    }
  }, [router.query, query]);

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
  }, []);

  // 保存当前搜索
  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim()) return;

    try {
      await saveSearchMutation.mutateAsync({
        name: saveSearchName.trim(),
        searchParams,
      });
    } catch (error) {
      console.error("保存搜索失败:", error);
    }
  }, [saveSearchName, searchParams, saveSearchMutation]);

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSavedSearches(!showSavedSearches)}
                className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
                  showSavedSearches
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <BookmarkIcon className="mr-2 h-4 w-4" />
                保存的搜索
              </button>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
                  showAdvanced
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AdjustmentsHorizontalIcon className="mr-2 h-4 w-4" />
                高级筛选
              </button>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索任务、笔记、项目..."
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
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "搜索中..." : "搜索"}
              </button>
            </div>

            {/* 搜索范围 */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                搜索范围
              </label>
              <div className="flex flex-wrap gap-2">
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

          {/* 保存的搜索 */}
          {showSavedSearches && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                保存的搜索
              </h3>
              {savedSearches && savedSearches.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="cursor-pointer rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                      onClick={() => {
                        // 加载保存的搜索参数
                        const params = search.searchParams;
                        setQuery(params.query ?? "");
                        setSearchIn(params.searchIn ?? ["tasks"]);
                        // 设置其他参数...
                        void refetch();
                      }}
                    >
                      <h4 className="text-base font-medium text-gray-900">
                        {search.name}
                      </h4>
                      {search.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {search.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(search.updatedAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无保存的搜索</p>
              )}

              {/* 保存当前搜索 */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h4 className="mb-2 text-sm font-medium text-gray-900">
                  保存当前搜索
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="搜索名称"
                    value={saveSearchName}
                    onChange={(e) => setSaveSearchName(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveSearch}
                    disabled={
                      !saveSearchName.trim() || saveSearchMutation.isPending
                    }
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

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
          <SearchResults
            results={searchResults}
            isLoading={isLoading}
            query={query}
            searchIn={searchIn}
          />
        </div>
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
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">高级筛选</h3>
        <button
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          清空筛选
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  query,
  searchIn,
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

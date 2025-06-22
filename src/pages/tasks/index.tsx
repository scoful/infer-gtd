import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useMemo, useCallback } from "react";
import {
  PlusIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading, ConfirmModal } from "@/components/UI";
import TaskModal from "@/components/Tasks/TaskModal";
import TaskFeedbackModal from "@/components/Tasks/TaskFeedbackModal";
import TimeEntryModal from "@/components/TimeEntryModal";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useConfirm } from "@/hooks";
import { TagList, type TagData } from "@/components/Tags";

// 视图模式类型
type ViewMode = "list" | "compact" | "detailed" | "timeTracking";

// 排序字段类型
type SortField = "dueDate" | "priority" | "createdAt" | "title" | "status" | "sortOrder";
type SortDirection = "asc" | "desc";

// 筛选状态接口
interface FilterState {
  status: TaskStatus[];
  priority: Priority[];
  tagIds: string[];
  search: string;
}

// 扩展Task类型以包含关联数据
type TaskWithRelations = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  type: TaskType;
  priority?: Priority | null;
  dueDate?: Date | null;
  dueTime?: string | null;
  completedAt?: Date | null;
  totalTimeSpent: number;
  isTimerActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: string; name: string; color?: string | null } | null;
  tags: Array<{
    tag: { id: string; name: string; color?: string | null; type: any; category?: string | null; isSystem: boolean; description?: string | null; icon?: string | null };
  }>;
  timeEntries: Array<{
    id: string;
    startTime: Date;
    endTime?: Date | null;
  }>;
  _count: {
    timeEntries: number;
    statusHistory: number;
  };
};

const TaskListPage: NextPage = () => {
  const { data: sessionData } = useSession();

  // 状态管理
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("sortOrder");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // 计时明细模态框状态
  const [isTimeEntryModalOpen, setIsTimeEntryModalOpen] = useState(false);
  const [timeEntryTaskId, setTimeEntryTaskId] = useState<string | null>(null);
  const [timeEntryTaskTitle, setTimeEntryTaskTitle] = useState<string>("");

  // 任务反馈模态框状态
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [feedbackTaskTitle, setFeedbackTaskTitle] = useState<string>("");

  // 确认模态框状态
  const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: [],
    tagIds: [],
    search: "",
  });

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: any = {
      limit: 50,
    };

    if (filters.search.trim()) {
      params.search = filters.search.trim();
    }

    if (filters.status.length === 1) {
      params.status = filters.status[0];
    }

    if (filters.priority.length === 1) {
      params.priority = filters.priority[0];
    }

    if (filters.tagIds.length > 0) {
      params.tagIds = filters.tagIds;
    }

    return params;
  }, [filters]);

  // 获取任务数据
  const { data: tasksData, isLoading, refetch, isFetching } = api.task.getAll.useQuery(
    queryParams,
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000, // 30秒缓存
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  // 获取标签数据用于筛选
  const { data: tagsData } = api.tag.getAll.useQuery(
    { limit: 100 },
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 任务操作相关的mutations
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // 批量更新任务
  const batchUpdateTasks = api.task.batchUpdate.useMutation({
    onSuccess: () => {
      void refetch();
      setSelectedTasks(new Set());
    },
  });

  // 批量删除任务
  const batchDeleteTasks = api.task.batchDelete.useMutation({
    onSuccess: (result) => {
      void refetch();
      setSelectedTasks(new Set());
      // 显示删除成功消息
      console.log(`成功删除 ${result.deletedCount} 个任务`);
    },
    onError: (error) => {
      console.error("批量删除失败:", error);
    },
  });

  // 格式化时间显示
  const formatTimeSpent = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // 检查计时器是否激活
  const isTimerActive = useCallback((task: TaskWithRelations): boolean => {
    return task.isTimerActive && task.timeEntries.some(entry => !entry.endTime);
  }, []);

  // 处理任务选择
  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (!tasksData?.tasks) return;
    
    const allTaskIds = tasksData.tasks.map(task => task.id);
    const allSelected = allTaskIds.every(id => selectedTasks.has(id));
    
    if (allSelected) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(allTaskIds));
    }
  }, [tasksData?.tasks, selectedTasks]);

  // 处理批量状态更新
  const handleBatchStatusUpdate = useCallback(async (status: TaskStatus) => {
    if (selectedTasks.size === 0) return;

    try {
      await batchUpdateTasks.mutateAsync({
        taskIds: Array.from(selectedTasks),
        updates: { status },
      });
    } catch (error) {
      console.error("批量更新失败:", error);
    }
  }, [selectedTasks, batchUpdateTasks]);

  // 处理批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedTasks.size === 0) return;

    const taskCount = selectedTasks.size;
    const confirmed = await showConfirm({
      title: "确认删除任务",
      message: `确定要删除选中的 ${taskCount} 个任务吗？\n\n删除后无法恢复，请谨慎操作。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await batchDeleteTasks.mutateAsync({
        taskIds: Array.from(selectedTasks),
      });
    } catch (error) {
      console.error("批量删除失败:", error);
    } finally {
      setLoading(false);
      hideConfirm();
    }
  }, [selectedTasks, batchDeleteTasks, showConfirm, setLoading, hideConfirm]);

  // 处理任务编辑
  const handleEditTask = useCallback((taskId: string) => {
    setEditingTaskId(taskId);
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

  // 处理筛选更新
  const handleFilterUpdate = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // 清空筛选
  const clearFilters = useCallback(() => {
    setFilters({
      status: [],
      priority: [],
      tagIds: [],
      search: "",
    });
  }, []);

  // 任务数据处理
  const tasks = tasksData?.tasks || [];
  const hasNextPage = false; // 暂时禁用分页功能

  // 打开计时明细
  const handleViewTimeEntries = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTimeEntryTaskId(taskId);
    setTimeEntryTaskTitle(task.title);
    setIsTimeEntryModalOpen(true);
  }, [tasks]);

  // 处理任务状态变更
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: newStatus,
        note: `状态变更为${getStatusLabel(newStatus)}`,
      });

      // 如果状态变为已完成，触发反馈收集
      if (newStatus === TaskStatus.DONE) {
        setFeedbackTaskId(taskId);
        setFeedbackTaskTitle(task.title);
        setIsFeedbackModalOpen(true);
      }
    } catch (error) {
      console.error("状态更新失败:", error);
    }
  }, [tasks, updateTaskStatus]);

  // 处理反馈模态框关闭
  const handleFeedbackModalClose = useCallback(() => {
    setIsFeedbackModalOpen(false);
    setFeedbackTaskId(null);
    setFeedbackTaskTitle("");
  }, []);

  // 处理反馈保存成功
  const handleFeedbackSuccess = useCallback(() => {
    void refetch();
    handleFeedbackModalClose();
  }, [refetch, handleFeedbackModalClose]);

  // 应用客户端排序（如果需要多状态筛选）
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // 客户端筛选（当有多个状态、优先级或标签筛选时）
    if (filters.status.length > 1) {
      result = result.filter(task => filters.status.includes(task.status));
    }

    if (filters.priority.length > 1) {
      result = result.filter(task =>
        task.priority && filters.priority.includes(task.priority)
      );
    }

    // 标签筛选（客户端处理多标签筛选）- 使用包含关系
    if (filters.tagIds.length > 0) {
      result = result.filter(task => {
        const taskTagIds = task.tags.map(tagRelation => tagRelation.tag.id);
        // 任务必须包含所有选中的标签
        return filters.tagIds.every(tagId => taskTagIds.includes(tagId));
      });
    }

    // 客户端排序
    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "dueDate":
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          break;
        case "priority":
          const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          aValue = a.priority ? priorityOrder[a.priority] : 0;
          bValue = b.priority ? priorityOrder[b.priority] : 0;
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "status":
          const statusOrder: Record<TaskStatus, number> = {
            IDEA: 1, TODO: 2, IN_PROGRESS: 3, WAITING: 4, DONE: 5, ARCHIVED: 6
          };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        case "sortOrder":
          aValue = a.sortOrder ?? 0;
          bValue = b.sortOrder ?? 0;
          break;
        default:
          return 0;
      }

      // 主排序字段比较
      let primaryResult = 0;
      if (aValue < bValue) primaryResult = -1;
      else if (aValue > bValue) primaryResult = 1;

      // 应用排序方向到主排序字段
      if (primaryResult !== 0) {
        return sortDirection === "asc" ? primaryResult : -primaryResult;
      }

      // 多级排序 - 与看板页面API排序逻辑保持一致
      // 次级排序：按状态升序
      const statusOrder: Record<TaskStatus, number> = {
        IDEA: 1, TODO: 2, IN_PROGRESS: 3, WAITING: 4, DONE: 5, ARCHIVED: 6
      };
      const statusResult = statusOrder[a.status] - statusOrder[b.status];
      if (statusResult !== 0) return statusResult;

      // 三级排序：按sortOrder升序（保持用户拖拽的顺序）
      const sortOrderResult = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (sortOrderResult !== 0) return sortOrderResult;

      // 四级排序：按优先级降序
      const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aPriority = a.priority ? priorityOrder[a.priority] : 0;
      const bPriority = b.priority ? priorityOrder[b.priority] : 0;
      const priorityResult = bPriority - aPriority;
      if (priorityResult !== 0) return priorityResult;

      // 五级排序：按截止日期升序
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      const dateResult = aDate - bDate;
      if (dateResult !== 0) return dateResult;

      // 最后排序：按创建时间降序
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return bCreated - aCreated;
    });

    return result;
  }, [tasks, filters, sortField, sortDirection]);

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>任务列表 | Smart GTD</title>
          <meta name="description" content="管理和查看所有任务" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作栏 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">任务列表</h1>
              {isFetching && !isLoading && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  刷新中...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 新建任务按钮 */}
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新建任务
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
                  title="列表视图"
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`px-3 py-2 text-sm font-medium border-t border-b ${
                    viewMode === "compact"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  title="紧凑视图"
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("timeTracking")}
                  className={`px-3 py-2 text-sm font-medium border-t border-b ${
                    viewMode === "timeTracking"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  title="计时视图"
                >
                  <ClockIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    window.location.href = "/tasks/kanban";
                  }}
                  className="px-3 py-2 text-sm font-medium rounded-r-md border bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  title="切换到看板视图"
                >
                  看板
                </button>
              </div>

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
            </div>
          </div>

          {/* 筛选面板 */}
          {showFilters && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 搜索框 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    搜索
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索任务标题或描述..."
                      value={filters.search}
                      onChange={(e) => handleFilterUpdate({ search: e.target.value })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 状态筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    状态
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: TaskStatus.IDEA, label: "想法" },
                      { value: TaskStatus.TODO, label: "待办" },
                      { value: TaskStatus.IN_PROGRESS, label: "进行中" },
                      { value: TaskStatus.WAITING, label: "等待中" },
                      { value: TaskStatus.DONE, label: "已完成" },
                      { value: TaskStatus.ARCHIVED, label: "已归档" },
                    ].map((status) => (
                      <label key={status.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status.value)}
                          onChange={(e) => {
                            const newStatus = e.target.checked
                              ? [...filters.status, status.value]
                              : filters.status.filter(s => s !== status.value);
                            handleFilterUpdate({ status: newStatus });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 优先级筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优先级
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: Priority.LOW, label: "低" },
                      { value: Priority.MEDIUM, label: "中" },
                      { value: Priority.HIGH, label: "高" },
                      { value: Priority.URGENT, label: "紧急" },
                    ].map((priority) => (
                      <label key={priority.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.priority.includes(priority.value)}
                          onChange={(e) => {
                            const newPriority = e.target.checked
                              ? [...filters.priority, priority.value]
                              : filters.priority.filter(p => p !== priority.value);
                            handleFilterUpdate({ priority: newPriority });
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{priority.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 标签筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标签
                  </label>
                  <p className="text-xs text-gray-500 mb-2">选择多个标签时，显示包含所有标签的任务</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {tagsData?.tags && tagsData.tags.length > 0 ? (
                      tagsData.tags.map((tag) => (
                        <label key={tag.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.tagIds.includes(tag.id)}
                            onChange={(e) => {
                              const newTagIds = e.target.checked
                                ? [...filters.tagIds, tag.id]
                                : filters.tagIds.filter(id => id !== tag.id);
                              handleFilterUpdate({ tagIds: newTagIds });
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span
                            className="ml-2 text-sm text-gray-700 flex items-center"
                            style={{ color: tag.color || '#374151' }}
                          >
                            {tag.icon && <span className="mr-1">{tag.icon}</span>}
                            {tag.name}
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">暂无标签</div>
                    )}
                  </div>
                </div>

                {/* 排序 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    排序
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as SortField)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="sortOrder">自定义顺序</option>
                      <option value="dueDate">截止日期</option>
                      <option value="priority">优先级</option>
                      <option value="status">状态</option>
                      <option value="title">标题</option>
                      <option value="createdAt">创建时间</option>
                    </select>
                    <button
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                      title={sortDirection === "asc" ? "升序" : "降序"}
                    >
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </button>
                  </div>
                </div>
              </div>

              {/* 筛选操作 */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  {tasks.length} 个任务
                  {(filters.status.length > 0 || filters.priority.length > 0 || filters.tagIds.length > 0 || filters.search) &&
                    ` (已筛选)`
                  }
                </div>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  清空筛选
                </button>
              </div>
            </div>
          )}

          {/* 批量操作栏 */}
          {selectedTasks.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    已选择 {selectedTasks.size} 个任务
                  </span>
                  <button
                    onClick={() => setSelectedTasks(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    取消选择
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* 批量状态更新 */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        void handleBatchStatusUpdate(e.target.value as TaskStatus);
                        e.target.value = "";
                      }
                    }}
                    className="px-3 py-1 border border-blue-300 rounded text-sm bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>更改状态</option>
                    <option value={TaskStatus.IDEA}>想法</option>
                    <option value={TaskStatus.TODO}>待办</option>
                    <option value={TaskStatus.IN_PROGRESS}>进行中</option>
                    <option value={TaskStatus.WAITING}>等待中</option>
                    <option value={TaskStatus.DONE}>已完成</option>
                    <option value={TaskStatus.ARCHIVED}>已归档</option>
                  </select>

                  {/* 批量删除按钮 */}
                  <button
                    onClick={handleBatchDelete}
                    disabled={batchDeleteTasks.isPending}
                    className="px-3 py-1 border border-red-300 rounded text-sm bg-white text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title={`删除选中的 ${selectedTasks.size} 个任务`}
                  >
                    {batchDeleteTasks.isPending ? (
                      <>
                        <div className="animate-spin h-3 w-3 border border-red-600 border-t-transparent rounded-full"></div>
                        删除中...
                      </>
                    ) : (
                      <>
                        🗑️ 删除 ({selectedTasks.size})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 任务列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载任务列表中..."
            loadingComponent={<SectionLoading message="加载任务列表中..." />}
          >
            {viewMode === "timeTracking" ? (
              <TimeTrackingView
                tasks={filteredAndSortedTasks}
                formatTimeSpent={formatTimeSpent}
                isTimerActive={isTimerActive}
                onViewTimeEntries={handleViewTimeEntries}
                onEditTask={handleEditTask}
              />
            ) : filteredAndSortedTasks.length > 0 ? (
              <div className="space-y-4">
                {/* 全选控制 */}
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filteredAndSortedTasks.length > 0 && filteredAndSortedTasks.every(task => selectedTasks.has(task.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      全选 ({filteredAndSortedTasks.length} 个任务)
                    </span>
                  </label>

                  <div className="text-sm text-gray-500">
                    {selectedTasks.size > 0 && `已选择 ${selectedTasks.size} 个`}
                  </div>
                </div>

                {/* 任务卡片列表 */}
                <div className={`grid gap-4 ${
                  viewMode === "compact"
                    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1"
                }`}>
                  {filteredAndSortedTasks.map((task) => (
                    <TaskListCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleTaskSelect(task.id, selected)}
                      onEdit={() => handleEditTask(task.id)}
                      onStatusChange={(status) => {
                        void handleTaskStatusChange(task.id, status);
                      }}
                      formatTimeSpent={formatTimeSpent}
                      isTimerActive={isTimerActive(task)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>

                {/* 加载更多 */}
                {hasNextPage && (
                  <div className="text-center py-4">
                    <button
                      onClick={() => {
                        // TODO: 实现加载更多功能
                        console.log("加载更多");
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      加载更多
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <ListBulletIcon className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无任务</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search || filters.status.length > 0 || filters.priority.length > 0 || filters.tagIds.length > 0
                    ? "没有找到符合条件的任务"
                    : "开始创建您的第一个任务吧"
                  }
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    新建任务
                  </button>
                </div>
              </div>
            )}
          </QueryLoading>
        </div>

        {/* 计时明细模态框 */}
        <TimeEntryModal
          isOpen={isTimeEntryModalOpen}
          onClose={() => setIsTimeEntryModalOpen(false)}
          taskId={timeEntryTaskId || ""}
          taskTitle={timeEntryTaskTitle}
        />

        {/* 任务模态框 */}
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleTaskModalClose}
          taskId={editingTaskId || undefined}
          onSuccess={handleTaskModalSuccess}
        />

        {/* 任务反馈模态框 */}
        <TaskFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={handleFeedbackModalClose}
          taskId={feedbackTaskId || ""}
          taskTitle={feedbackTaskTitle}
          onSuccess={handleFeedbackSuccess}
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

// 获取状态标签
function getStatusLabel(status: TaskStatus): string {
  const statusLabels = {
    [TaskStatus.IDEA]: "想法",
    [TaskStatus.TODO]: "待办",
    [TaskStatus.IN_PROGRESS]: "进行中",
    [TaskStatus.WAITING]: "等待中",
    [TaskStatus.DONE]: "已完成",
    [TaskStatus.ARCHIVED]: "已归档",
  };
  return statusLabels[status];
}

// 任务列表卡片组件
interface TaskListCardProps {
  task: TaskWithRelations;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onStatusChange: (status: TaskStatus) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  viewMode: ViewMode;
}

function TaskListCard({
  task,
  isSelected,
  onSelect,
  onEdit,
  onStatusChange,
  formatTimeSpent,
  isTimerActive,
  viewMode,
}: TaskListCardProps) {
  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  const statusColors = {
    IDEA: "bg-gray-100 text-gray-800",
    TODO: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    WAITING: "bg-purple-100 text-purple-800",
    DONE: "bg-green-100 text-green-800",
    ARCHIVED: "bg-gray-100 text-gray-800",
  };

  return (
    <div
      className={`bg-white rounded-lg border p-4 transition-all duration-200 ${
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-gray-200 hover:shadow-md hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 选择框 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />

        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题和状态 */}
          <div className="flex items-start justify-between mb-2">
            <h4
              className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 line-clamp-2"
              onClick={onEdit}
            >
              {task.title}
            </h4>
            <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
              {getStatusLabel(task.status)}
            </span>
          </div>

          {/* 描述 */}
          {task.description && viewMode !== "compact" && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* 项目和标签 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {/* 项目显示 */}
            {task.project && (
              <span
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: task.project.color ? `${task.project.color}20` : '#f3f4f6',
                  color: task.project.color || '#374151',
                }}
              >
                📁 {task.project.name}
              </span>
            )}

            {/* 标签显示 */}
            {task.tags.length > 0 && (
              <TagList
                tags={task.tags.map(tagRelation => tagRelation.tag as TagData)}
                size="sm"
                variant="default"
                showIcon={true}
                maxDisplay={viewMode === "compact" ? 3 : 5} // 默认显示数量
                expandable={true} // 启用点击展开
                className="flex-wrap"
              />
            )}
          </div>

          {/* 任务反馈（仅在已完成且有反馈时显示） */}
          {task.status === TaskStatus.DONE && task.feedback && (
            <div className="bg-blue-50 rounded-md px-3 py-2 mb-3 border border-blue-200">
              <div className="flex items-start">
                <span className="text-sm text-blue-600 font-medium mr-2">💭</span>
                <p className="text-sm text-blue-700 line-clamp-2" title={task.feedback}>
                  {task.feedback}
                </p>
              </div>
            </div>
          )}

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {/* 优先级 */}
              {task.priority && (
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
              )}

              {/* 截止日期 */}
              {task.dueDate && (
                <span className="flex items-center">
                  📅 {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                  {task.dueTime && ` ${task.dueTime}`}
                </span>
              )}

              {/* 时间统计 */}
              {task.totalTimeSpent > 0 && (
                <span className="flex items-center">
                  ⏱️ {formatTimeSpent(task.totalTimeSpent)}
                </span>
              )}

              {/* 计时器状态 */}
              {isTimerActive && (
                <span className="flex items-center text-green-600">
                  🟢 计时中
                </span>
              )}
            </div>

            {/* 创建时间 */}
            <span>
              {new Date(task.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 计时视图组件
interface TimeTrackingViewProps {
  tasks: TaskWithRelations[];
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  onViewTimeEntries: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
}

function TimeTrackingView({
  tasks,
  formatTimeSpent,
  isTimerActive,
  onViewTimeEntries,
  onEditTask,
}: TimeTrackingViewProps) {
  // 筛选有计时记录的任务
  const tasksWithTimeEntries = tasks.filter(task => task.totalTimeSpent > 0 || isTimerActive(task));

  // 按总计时长排序
  const sortedTasks = [...tasksWithTimeEntries].sort((a, b) => b.totalTimeSpent - a.totalTimeSpent);

  // 计算统计信息
  const totalTimeSpent = tasksWithTimeEntries.reduce((sum, task) => sum + task.totalTimeSpent, 0);
  const activeTimers = tasksWithTimeEntries.filter(task => isTimerActive(task)).length;
  const totalSessions = tasksWithTimeEntries.reduce((sum, task) => sum + task._count.timeEntries, 0);

  if (tasksWithTimeEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">
          <ClockIcon className="h-12 w-12" />
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">暂无计时记录</h3>
        <p className="mt-1 text-sm text-gray-500">
          开始为任务计时后，这里将显示详细的时间统计信息
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">时间统计概览</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {tasksWithTimeEntries.length}
            </div>
            <div className="text-sm text-gray-500">有计时记录的任务</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatTimeSpent(totalTimeSpent)}
            </div>
            <div className="text-sm text-gray-500">总计时长</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {totalSessions}
            </div>
            <div className="text-sm text-gray-500">计时会话</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {activeTimers}
            </div>
            <div className="text-sm text-gray-500">正在计时</div>
          </div>
        </div>
      </div>

      {/* 任务时间列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">任务计时详情</h3>
          <p className="text-sm text-gray-500 mt-1">按总计时长排序</p>
        </div>
        <div className="divide-y divide-gray-200">
          {sortedTasks.map((task) => (
            <TimeTrackingTaskCard
              key={task.id}
              task={task}
              formatTimeSpent={formatTimeSpent}
              isTimerActive={isTimerActive(task)}
              onViewTimeEntries={() => onViewTimeEntries(task.id)}
              onEditTask={() => onEditTask(task.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// 计时任务卡片组件
interface TimeTrackingTaskCardProps {
  task: TaskWithRelations;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  onViewTimeEntries: () => void;
  onEditTask: () => void;
}

function TimeTrackingTaskCard({
  task,
  formatTimeSpent,
  isTimerActive,
  onViewTimeEntries,
  onEditTask,
}: TimeTrackingTaskCardProps) {
  const statusColors = {
    IDEA: "bg-gray-100 text-gray-800",
    TODO: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    WAITING: "bg-purple-100 text-purple-800",
    DONE: "bg-green-100 text-green-800",
    ARCHIVED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {/* 任务标题和状态 */}
          <div className="flex items-center gap-3 mb-2">
            <h4
              className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 truncate"
              onClick={onEditTask}
            >
              {task.title}
            </h4>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
              {getStatusLabel(task.status)}
            </span>
            {isTimerActive && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                🟢 计时中
              </span>
            )}
          </div>

          {/* 项目信息 */}
          {task.project && (
            <div className="flex items-center gap-1 mb-2">
              <span
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: task.project.color ? `${task.project.color}20` : '#f3f4f6',
                  color: task.project.color || '#374151',
                }}
              >
                📁 {task.project.name}
              </span>
            </div>
          )}

          {/* 任务反馈（仅在已完成且有反馈时显示） */}
          {task.status === TaskStatus.DONE && task.feedback && (
            <div className="bg-blue-50 rounded-md px-3 py-2 mb-2 border border-blue-200">
              <div className="flex items-start">
                <span className="text-sm text-blue-600 font-medium mr-2">💭</span>
                <p className="text-sm text-blue-700 line-clamp-2" title={task.feedback}>
                  {task.feedback}
                </p>
              </div>
            </div>
          )}

          {/* 时间统计 */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              总时长: {formatTimeSpent(task.totalTimeSpent)}
            </span>
            <span className="flex items-center gap-1">
              <ChartBarIcon className="h-4 w-4" />
              {task._count.timeEntries} 个会话
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onViewTimeEntries}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ChartBarIcon className="h-3 w-3 mr-1" />
            查看明细
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskListPage;

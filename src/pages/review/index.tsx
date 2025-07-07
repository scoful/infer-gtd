import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrophyIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import AuthGuard from "@/components/Layout/AuthGuard";
import MainLayout from "@/components/Layout/MainLayout";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { TaskStatus, TaskPriority } from "@prisma/client";

// 时间范围类型
type TimeRange = "week" | "month" | "year";

// 时间范围配置
const TIME_RANGE_CONFIG = {
  week: {
    label: "周",
    format: (date: Date) => {
      const year = date.getFullYear();
      const weekNumber = getWeekNumber(date);
      return `${year}年第${weekNumber}周`;
    },
    getRange: (date: Date) => getWeekRange(date),
    navigate: (date: Date, direction: "prev" | "next") => {
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
      return newDate;
    },
  },
  month: {
    label: "月",
    format: (date: Date) => {
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    },
    getRange: (date: Date) => getMonthRange(date),
    navigate: (date: Date, direction: "prev" | "next") => {
      const newDate = new Date(date);
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    },
  },
  year: {
    label: "年",
    format: (date: Date) => {
      return `${date.getFullYear()}年`;
    },
    getRange: (date: Date) => getYearRange(date),
    navigate: (date: Date, direction: "prev" | "next") => {
      const newDate = new Date(date);
      newDate.setFullYear(newDate.getFullYear() + (direction === "next" ? 1 : -1));
      return newDate;
    },
  },
};

// 获取周数
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// 获取周范围
function getWeekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 周一开始
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// 获取月范围
function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// 获取年范围
function getYearRange(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// 格式化日期范围
function formatDateRange(start: Date, end: Date, timeRange: TimeRange): string {
  if (timeRange === "week") {
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
  } else if (timeRange === "month") {
    return `${start.getFullYear()}年${start.getMonth() + 1}月`;
  } else {
    return `${start.getFullYear()}年`;
  }
}

const TaskReviewPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // 获取当前时间范围配置
  const config = TIME_RANGE_CONFIG[timeRange];
  
  // 计算当前时间范围的日期范围
  const dateRange = useMemo(() => config.getRange(currentDate), [currentDate, config]);

  // 获取任务统计
  const {
    data: taskStats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isFetching: isFetchingStats,
  } = api.task.getStats.useQuery(
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    { enabled: !!sessionData },
  );

  // 获取任务列表
  const {
    data: tasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
    isFetching: isFetchingTasks,
  } = api.task.getAll.useQuery(
    {
      createdAfter: dateRange.start,
      createdBefore: dateRange.end,
      limit: 100,
    },
    { enabled: !!sessionData },
  );

  // 获取完成的任务
  const {
    data: completedTasks,
    refetch: refetchCompletedTasks,
    isFetching: isFetchingCompletedTasks,
  } = api.task.getAll.useQuery(
    {
      status: TaskStatus.DONE,
      completedAfter: dateRange.start,
      completedBefore: dateRange.end,
      limit: 50,
    },
    { enabled: !!sessionData },
  );

  // 获取时间追踪数据
  const {
    data: timeEntries,
    refetch: refetchTimeEntries,
    isFetching: isFetchingTimeEntries,
  } = api.task.getTimeEntries.useQuery(
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: 100,
    },
    { enabled: !!sessionData },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetchStats(),
      refetchTasks(),
      refetchCompletedTasks(),
      refetchTimeEntries(),
    ]);
  }, [refetchStats, refetchTasks, refetchCompletedTasks, refetchTimeEntries]);

  const isAnyLoading = statsLoading || tasksLoading;
  const isAnyFetching = isFetchingStats || isFetchingTasks || isFetchingCompletedTasks || isFetchingTimeEntries;

  // 计算详细统计
  const detailedStats = useMemo(() => {
    if (!tasks?.tasks || !completedTasks?.tasks || !timeEntries?.entries) {
      return null;
    }

    const allTasks = tasks.tasks;
    const completed = completedTasks.tasks;
    const entries = timeEntries.entries;

    const totalTasks = allTasks.length;
    const completedCount = completed.length;
    const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    // 优先级统计
    const priorityStats = allTasks.reduce(
      (acc, task) => {
        if (task.priority) {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
        }
        return acc;
      },
      {} as Record<TaskPriority, number>,
    );

    // 状态统计
    const statusStats = allTasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<TaskStatus, number>,
    );

    // 时间统计
    const totalTimeSpent = entries.reduce((total, entry) => {
      return total + (entry.duration || 0);
    }, 0);

    // 逾期任务统计
    const now = new Date();
    const overdueTasks = allTasks.filter(
      (task) => task.dueDate && new Date(task.dueDate) < now && task.status !== TaskStatus.DONE,
    );

    // 计算平均值（根据时间范围调整）
    const periodDays = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365;
    const averageTasksPerDay = totalTasks / periodDays;
    const averageCompletionPerDay = completedCount / periodDays;

    // 反馈统计
    const tasksWithFeedback = completed.filter(
      (task) => task.feedback && task.feedback.trim().length > 0,
    );
    const feedbackRate = completedCount > 0 ? (tasksWithFeedback.length / completedCount) * 100 : 0;

    return {
      totalTasks,
      completedCount,
      completionRate,
      priorityStats,
      statusStats,
      totalTimeSpent,
      overdueCount: overdueTasks.length,
      averageTasksPerDay,
      averageCompletionPerDay,
      tasksWithFeedback: tasksWithFeedback.length,
      feedbackRate,
    };
  }, [tasks, completedTasks, timeEntries, timeRange]);

  // 导航到上一个/下一个时间段
  const navigate = useCallback((direction: "prev" | "next") => {
    setCurrentDate(config.navigate(currentDate, direction));
  }, [currentDate, config]);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>任务回顾 | Infer GTD</title>
          <meta name="description" content="任务回顾和分析" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和控制器 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">任务回顾</h1>
                {isAnyFetching && !isAnyLoading && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                回顾任务完成情况和时间投入分析
              </p>
            </div>

            {/* 时间范围选择器 */}
            <div className="flex items-center gap-4">
              <div className="flex rounded-lg border border-gray-300 bg-white">
                {(Object.keys(TIME_RANGE_CONFIG) as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      timeRange === range
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 hover:bg-gray-50"
                    } ${range === "week" ? "rounded-l-lg" : range === "year" ? "rounded-r-lg" : ""}`}
                  >
                    按{TIME_RANGE_CONFIG[range].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 时间导航 */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("prev")}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={`上一${config.label}`}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {config.format(currentDate)}
              </div>
              <div className="text-sm text-gray-500">
                {formatDateRange(dateRange.start, dateRange.end, timeRange)}
              </div>
            </div>

            <button
              onClick={() => navigate("next")}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={`下一${config.label}`}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* 统计概览 */}
          <QueryLoading
            isLoading={isAnyLoading}
            error={null}
            loadingMessage="加载任务回顾数据中..."
            loadingComponent={<SectionLoading message="加载任务回顾数据中..." />}
          >
            {detailedStats && (
              <>
                {/* 关键指标卡片 */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
                  {/* 任务完成率 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <TrophyIcon className="h-8 w-8 text-yellow-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">完成率</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {detailedStats.completionRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {detailedStats.completedCount}/{detailedStats.totalTasks} 个任务
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 总时间投入 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ClockIcon className="h-8 w-8 text-blue-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">时间投入</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatTime(detailedStats.totalTimeSpent)}
                        </p>
                        <p className="text-xs text-gray-500">
                          平均每天 {formatTime(detailedStats.totalTimeSpent / (timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 完成任务数 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CheckCircleIcon className="h-8 w-8 text-green-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">已完成</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {detailedStats.completedCount}
                        </p>
                        <p className="text-xs text-gray-500">
                          平均每天 {detailedStats.averageCompletionPerDay.toFixed(1)} 个
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 逾期任务 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">逾期任务</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {detailedStats.overdueCount}
                        </p>
                        <p className="text-xs text-gray-500">
                          需要关注处理
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 反馈率 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-purple-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">反馈率</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {detailedStats.feedbackRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {detailedStats.tasksWithFeedback} 个任务有反馈
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 详细分析 */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* 优先级分布 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                      <ChartBarIcon className="mr-2 h-5 w-5 text-blue-500" />
                      优先级分布
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(detailedStats.priorityStats).map(([priority, count]) => {
                        const percentage = detailedStats.totalTasks > 0 ? (count / detailedStats.totalTasks) * 100 : 0;
                        const priorityColors = {
                          HIGH: "bg-red-500",
                          MEDIUM: "bg-yellow-500",
                          LOW: "bg-green-500",
                        };
                        const priorityLabels = {
                          HIGH: "高优先级",
                          MEDIUM: "中优先级",
                          LOW: "低优先级",
                        };
                        return (
                          <div key={priority} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`mr-3 h-3 w-3 rounded-full ${priorityColors[priority as TaskPriority]}`}></div>
                              <span className="text-sm text-gray-700">
                                {priorityLabels[priority as TaskPriority]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{count}</span>
                              <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 状态分布 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                      <CalendarIcon className="mr-2 h-5 w-5 text-green-500" />
                      状态分布
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(detailedStats.statusStats).map(([status, count]) => {
                        const percentage = detailedStats.totalTasks > 0 ? (count / detailedStats.totalTasks) * 100 : 0;
                        const statusColors = {
                          TODO: "bg-gray-500",
                          IN_PROGRESS: "bg-blue-500",
                          DONE: "bg-green-500",
                          CANCELLED: "bg-red-500",
                        };
                        const statusLabels = {
                          TODO: "待处理",
                          IN_PROGRESS: "进行中",
                          DONE: "已完成",
                          CANCELLED: "已取消",
                        };
                        return (
                          <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`mr-3 h-3 w-3 rounded-full ${statusColors[status as TaskStatus]}`}></div>
                              <span className="text-sm text-gray-700">
                                {statusLabels[status as TaskStatus]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{count}</span>
                              <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 完成的任务列表 */}
                {completedTasks?.tasks && completedTasks.tasks.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                      <CheckCircleIcon className="mr-2 h-5 w-5 text-green-500" />
                      {timeRange === "week" ? "本周" : timeRange === "month" ? "本月" : "本年"}完成的任务
                    </h3>
                    <div className="space-y-4">
                      {completedTasks.tasks.slice(0, 10).map((task) => (
                        <div
                          key={task.id}
                          className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="text-base font-medium text-gray-900">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="mt-1 line-clamp-1 text-xs text-gray-600">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="ml-4 flex flex-col items-end gap-1">
                              {task.priority && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                    task.priority === "HIGH"
                                      ? "bg-red-100 text-red-800"
                                      : task.priority === "MEDIUM"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {task.priority === "HIGH"
                                    ? "高"
                                    : task.priority === "MEDIUM"
                                      ? "中"
                                      : "低"}
                                </span>
                              )}
                              {task.totalTimeSpent > 0 && (
                                <span className="text-xs text-gray-500">
                                  {formatTime(task.totalTimeSpent)}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.feedback && (
                            <div className="mt-2 rounded-md bg-gray-50 p-3">
                              <p className="text-sm text-gray-700">{task.feedback}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {completedTasks.tasks.length > 10 && (
                        <div className="pt-4 text-center">
                          <p className="text-sm text-gray-500">
                            还有 {completedTasks.tasks.length - 10} 个已完成的任务...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </QueryLoading>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default TaskReviewPage;

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
import {
  TimeDistributionHeatmap,
  ProjectCompletionPieChart,
  PriorityDistributionChart,
  CompletionTrendChart,
  DailyCompletionChart,
} from "@/components/Charts";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { TaskStatus, Priority } from "@prisma/client";

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


  // 计算当前时间范围的日期范围
  const dateRange = useMemo(() => {
    const config = TIME_RANGE_CONFIG[timeRange];
    return config.getRange(currentDate);
  }, [currentDate, timeRange]);

  // 获取任务统计
  const {
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

  // 获取项目统计数据
  const {
    refetch: refetchProjects,
  } = api.project.getAll.useQuery(
    { limit: 50 },
    { enabled: !!sessionData },
  );

  // 获取标签统计数据
  const {
    refetch: refetchTags,
  } = api.tag.getAll.useQuery(
    { limit: 50, includeCount: true },
    { enabled: !!sessionData },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetchStats(),
      refetchTasks(),
      refetchCompletedTasks(),
      refetchTimeEntries(),
      refetchProjects(),
      refetchTags(),
    ]);
  }, [refetchStats, refetchTasks, refetchCompletedTasks, refetchTimeEntries, refetchProjects, refetchTags]);

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

    // 优先级统计 - 确保所有优先级都有值
    const priorityStats: Record<Priority, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    allTasks.forEach((task) => {
      if (task.priority) {
        priorityStats[task.priority]++;
      }
    });

    // 状态统计 - 确保所有状态都有值
    const statusStats: Record<TaskStatus, number> = {
      IDEA: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      WAITING: 0,
      DONE: 0,
      ARCHIVED: 0,
    };

    allTasks.forEach((task) => {
      statusStats[task.status]++;
    });

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

    // 时间分布分析 - 新建任务和完成任务
    const timeDistribution: Record<number, { created: number; completed: number }> = {};

    // 初始化24小时数据
    for (let hour = 0; hour < 24; hour++) {
      timeDistribution[hour] = { created: 0, completed: 0 };
    }

    // 统计新建任务的时间分布
    allTasks.forEach((task) => {
      const hour = new Date(task.createdAt).getHours();
      timeDistribution[hour].created++;
    });

    // 统计完成任务的时间分布
    completed.forEach((task) => {
      if (task.completedAt) {
        const hour = new Date(task.completedAt).getHours();
        timeDistribution[hour].completed++;
      }
    });

    // 项目分布分析
    const projectStats = allTasks.reduce((acc, task) => {
      const projectName = task.project?.name || "无项目";
      if (!acc[projectName]) {
        acc[projectName] = { total: 0, completed: 0 };
      }
      acc[projectName].total++;
      if (task.status === TaskStatus.DONE) {
        acc[projectName].completed++;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    // 标签使用统计 - 包含完整标签信息
    const tagStatsMap = new Map<string, { tag: any; count: number }>();
    allTasks.forEach((task) => {
      task.tags?.forEach((taskTag) => {
        const tagId = taskTag.tag.id;
        const existing = tagStatsMap.get(tagId);
        if (existing) {
          existing.count++;
        } else {
          tagStatsMap.set(tagId, { tag: taskTag.tag, count: 1 });
        }
      });
    });

    // 转换为数组并按使用次数排序
    const tagStats = Array.from(tagStatsMap.values())
      .sort((a, b) => b.count - a.count);

    // 每日完成趋势（仅对周和月有效）
    const dailyCompletion: Record<string, number> = {};
    if (timeRange !== "year") {
      completed.forEach((task) => {
        if (task.completedAt) {
          const dateKey = new Date(task.completedAt).toISOString().split("T")[0]!;
          dailyCompletion[dateKey] = (dailyCompletion[dateKey] || 0) + 1;
        }
      });
    }

    // 生产力洞察
    const insights = [];

    // 最活跃的完成时间
    const mostActiveHour = Object.entries(timeDistribution).reduce(
      (max, [hour, data]) => data.completed > max.count ? { hour: parseInt(hour), count: data.completed } : max,
      { hour: 0, count: 0 }
    );

    if (mostActiveHour.count > 0) {
      insights.push(`您在 ${mostActiveHour.hour}:00 时段最为高效，完成了 ${mostActiveHour.count} 个任务`);
    }

    // 项目完成率分析
    const projectCompletionRates = Object.entries(projectStats).map(([name, stats]) => ({
      name,
      rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      total: stats.total,
    })).sort((a, b) => b.rate - a.rate);

    if (projectCompletionRates.length > 0) {
      const bestProject = projectCompletionRates[0];
      if (bestProject && bestProject.rate > 0) {
        insights.push(`"${bestProject.name}" 项目完成率最高 (${bestProject.rate.toFixed(1)}%)`);
      }
    }

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
      timeDistribution,
      projectStats,
      tagStats,
      dailyCompletion,
      insights,
      projectCompletionRates,
    };
  }, [tasks, completedTasks, timeEntries, timeRange]);

  // 生成趋势数据 - 新建任务、完成任务、完成率三条线
  const trendData = useMemo(() => {
    if (!tasks?.tasks || !completedTasks?.tasks) {
      return [];
    }

    const dates: Array<{
      date: string;
      created: number;      // 新建任务数
      completed: number;    // 完成任务数
      completionRate: number; // 完成率
    }> = [];
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let time = startTime; time <= endTime; time += oneDay) {
      const current = new Date(time);
      const dateKey = current.toISOString().split("T")[0]!;

      // 当日新建的任务
      const dayCreated = tasks.tasks.filter(task => {
        const taskDate = new Date(task.createdAt).toISOString().split("T")[0];
        return taskDate === dateKey;
      });

      // 当日完成的任务
      const dayCompleted = completedTasks.tasks.filter(task => {
        if (!task.completedAt) return false;
        const completedDate = new Date(task.completedAt).toISOString().split("T")[0];
        return completedDate === dateKey;
      });

      const created = dayCreated.length;
      const completed = dayCompleted.length;

      // 计算完成率：当日完成任务数 / 当日新建任务数
      // 如果当日没有新建任务但有完成任务，则显示为100%
      const completionRate = created > 0 ? (completed / created) * 100 :
                           completed > 0 ? 100 : 0;

      dates.push({
        date: dateKey,
        created,
        completed,
        completionRate,
      });
    }

    return dates;
  }, [tasks?.tasks, completedTasks?.tasks, dateRange.start.getTime(), dateRange.end.getTime()]);

  // 导航到上一个/下一个时间段
  const navigate = useCallback((direction: "prev" | "next") => {
    const config = TIME_RANGE_CONFIG[timeRange];
    setCurrentDate(config.navigate(currentDate, direction));
  }, [currentDate, timeRange]);

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

            {/* 时间范围选择器和图表切换 */}
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
              title={`上一${TIME_RANGE_CONFIG[timeRange].label}`}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {TIME_RANGE_CONFIG[timeRange].format(currentDate)}
              </div>
              <div className="text-sm text-gray-500">
                {formatDateRange(dateRange.start, dateRange.end, timeRange)}
              </div>
            </div>

            <button
              onClick={() => navigate("next")}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={`下一${TIME_RANGE_CONFIG[timeRange].label}`}
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
                          {detailedStats.tasksWithFeedback}/{completedTasks.totalCount} 个任务有反馈
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
                      {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((priority) => {
                        const count = detailedStats.priorityStats[priority] || 0;
                        const percentage = detailedStats.totalTasks > 0 ? (count / detailedStats.totalTasks) * 100 : 0;
                        const priorityColors: Record<Priority, string> = {
                          URGENT: "bg-red-500",
                          HIGH: "bg-orange-500",
                          MEDIUM: "bg-yellow-500",
                          LOW: "bg-green-500",
                        };
                        const priorityLabels: Record<Priority, string> = {
                          URGENT: "紧急",
                          HIGH: "高优先级",
                          MEDIUM: "中优先级",
                          LOW: "低优先级",
                        };
                        return (
                          <div key={priority} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`mr-3 h-3 w-3 rounded-full ${priorityColors[priority]}`}></div>
                              <span className="text-sm text-gray-700">
                                {priorityLabels[priority]}
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
                      {(["IDEA", "TODO", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] as TaskStatus[]).map((status) => {
                        const count = detailedStats.statusStats[status] || 0;
                        const percentage = detailedStats.totalTasks > 0 ? (count / detailedStats.totalTasks) * 100 : 0;
                        const statusColors: Record<TaskStatus, string> = {
                          IDEA: "bg-gray-500",
                          TODO: "bg-blue-500",
                          IN_PROGRESS: "bg-yellow-500",
                          WAITING: "bg-purple-500",
                          DONE: "bg-green-500",
                          ARCHIVED: "bg-gray-400",
                        };
                        const statusLabels: Record<TaskStatus, string> = {
                          IDEA: "想法",
                          TODO: "待处理",
                          IN_PROGRESS: "进行中",
                          WAITING: "等待中",
                          DONE: "已完成",
                          ARCHIVED: "已归档",
                        };
                        return (
                          <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`mr-3 h-3 w-3 rounded-full ${statusColors[status]}`}></div>
                              <span className="text-sm text-gray-700">
                                {statusLabels[status]}
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

                {/* 高级分析 */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* 时间分布分析 */}
                  {Object.keys(detailedStats.timeDistribution).length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                        <ClockIcon className="mr-2 h-5 w-5 text-purple-500" />
                        完成时间分布
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(detailedStats.timeDistribution)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .filter(([, data]) => data.created > 0 || data.completed > 0)
                          .slice(0, 8)
                          .map(([hour, data]) => {
                            const maxCount = Math.max(...Object.values(detailedStats.timeDistribution).map(d => Math.max(d.created, d.completed)));
                            const createdPercentage = maxCount > 0 ? (data.created / maxCount) * 100 : 0;
                            const completedPercentage = maxCount > 0 ? (data.completed / maxCount) * 100 : 0;
                            return (
                              <div key={hour} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium text-gray-700">
                                    {hour.padStart(2, '0')}:00
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    新建:{data.created} 完成:{data.completed}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
                                      <div
                                        className="bg-orange-400"
                                        style={{ width: `${createdPercentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
                                      <div
                                        className="bg-blue-500"
                                        style={{ width: `${completedPercentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* 项目分布分析 */}
                  {Object.keys(detailedStats.projectStats).length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                        <ChartBarIcon className="mr-2 h-5 w-5 text-indigo-500" />
                        项目分布
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(detailedStats.projectStats)
                          .sort(([,a], [,b]) => b.total - a.total)
                          .slice(0, 6)
                          .map(([projectName, stats]) => {
                            const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                            return (
                              <div key={projectName} className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {projectName}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {stats.completed}/{stats.total}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${completionRate}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <div className="ml-3 text-sm font-medium text-gray-900">
                                  {completionRate.toFixed(0)}%
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 标签使用分析 */}
                {detailedStats.tagStats.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                      <CalendarIcon className="mr-2 h-5 w-5 text-emerald-500" />
                      热门标签
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {detailedStats.tagStats
                        .slice(0, 10)
                        .map(({ tag, count }) => {
                          // 获取标签颜色，如果没有则使用默认颜色
                          const tagColor = tag.color || "#6B7280";

                          return (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{
                                backgroundColor: tagColor,
                              }}
                            >
                              {tag.icon && (
                                <span className="mr-1.5 text-xs">
                                  {tag.icon}
                                </span>
                              )}
                              {tag.name}
                              <span
                                className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                  color: 'white',
                                }}
                              >
                                {count}
                              </span>
                            </span>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 生产力洞察 */}
                {detailedStats.insights.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                    <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                      <TrophyIcon className="mr-2 h-5 w-5 text-blue-500" />
                      生产力洞察
                    </h3>
                    <div className="space-y-3">
                      {detailedStats.insights.map((insight, index) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                            <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 数据可视化图表 */}
                {detailedStats && (
                  <div className="space-y-8">
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="mb-6 flex items-center text-lg font-medium text-gray-900">
                        <ChartBarIcon className="mr-2 h-5 w-5 text-blue-500" />
                        数据可视化分析
                      </h3>

                      <div className="space-y-8">
                        {/* 任务完成趋势图 */}
                        {trendData.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-base font-medium text-gray-800">
                              任务完成趋势
                            </h4>
                            <p className="mb-4 text-sm text-gray-600">
                              显示每日新建任务、完成任务数量和完成率的变化趋势，帮助了解工作节奏和效率
                            </p>
                            <CompletionTrendChart
                              data={trendData}
                              timeRange={timeRange}
                            />
                          </div>
                        )}

                        {/* 时间分布柱状图 */}
                        <div>
                          <h4 className="mb-2 text-base font-medium text-gray-800">
                            时间分布分析
                          </h4>
                          <p className="mb-4 text-sm text-gray-600">
                            显示新建任务和完成任务在一天中不同时段的分布情况，帮助识别最佳工作时段
                          </p>
                          <TimeDistributionHeatmap
                            data={detailedStats.timeDistribution}
                          />
                        </div>

                        {/* 项目完成率饼图 */}
                        {Object.keys(detailedStats.projectStats).length > 0 && (
                          <div>
                            <h4 className="mb-2 text-base font-medium text-gray-800">
                              项目任务分布
                            </h4>
                            <p className="mb-4 text-sm text-gray-600">
                              显示各项目的任务总数和完成率对比，帮助评估项目进展
                            </p>
                            <ProjectCompletionPieChart
                              data={detailedStats.projectStats}
                            />
                          </div>
                        )}

                        {/* 优先级分布柱状图 */}
                        {detailedStats && (
                          <div>
                            <h4 className="mb-2 text-base font-medium text-gray-800">
                              优先级分布
                            </h4>
                            <p className="mb-4 text-sm text-gray-600">
                              显示所有任务按优先级的数量分布，帮助优化时间管理策略
                            </p>
                            <PriorityDistributionChart
                              data={detailedStats.priorityStats}
                              totalTasks={detailedStats.totalTasks}
                            />
                          </div>
                        )}

                        {/* 每日完成趋势图 */}
                        {timeRange !== "year" && Object.keys(detailedStats.dailyCompletion).length > 0 && (
                          <div>
                            <h4 className="mb-2 text-base font-medium text-gray-800">
                              每日完成趋势
                            </h4>
                            <p className="mb-4 text-sm text-gray-600">
                              显示每天实际完成的任务数量和工作模式分析
                            </p>
                            <DailyCompletionChart
                              data={detailedStats.dailyCompletion}
                              timeRange={timeRange}
                              dateRange={dateRange}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                                    task.priority === "URGENT"
                                      ? "bg-red-100 text-red-800"
                                      : task.priority === "HIGH"
                                        ? "bg-orange-100 text-orange-800"
                                        : task.priority === "MEDIUM"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {task.priority === "URGENT"
                                    ? "紧急"
                                    : task.priority === "HIGH"
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

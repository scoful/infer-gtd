import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useMemo } from "react";
import {
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { SectionLoading } from "@/components/UI";

// 获取周的开始和结束日期
function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 周一为一周开始
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// 格式化周范围
function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
  return `${startStr} - ${endStr}`;
}

const WeeklyReviewPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // 计算当前周的日期范围
  const weekRange = useMemo(() => getWeekRange(currentWeek), [currentWeek]);

  // 获取本周任务统计
  const { data: weeklyStats, isLoading: statsLoading } =
    api.task.getStats.useQuery(
      {
        startDate: weekRange.start,
        endDate: weekRange.end,
      },
      { enabled: !!sessionData },
    );

  // 获取本周任务列表
  const { data: weeklyTasks, isLoading: tasksLoading } =
    api.task.getAll.useQuery(
      {
        createdAfter: weekRange.start,
        createdBefore: weekRange.end,
        limit: 100,
      },
      { enabled: !!sessionData },
    );

  // 获取本周完成的任务
  const { data: completedTasks } = api.task.getAll.useQuery(
    {
      status: TaskStatus.DONE,
      completedAfter: weekRange.start,
      completedBefore: weekRange.end,
      limit: 50,
    },
    { enabled: !!sessionData },
  );

  // 获取本周时间追踪数据
  const { data: timeEntries } = api.task.getTimeEntries.useQuery(
    {
      startDate: weekRange.start,
      endDate: weekRange.end,
      limit: 100,
    },
    { enabled: !!sessionData },
  );

  // 计算周统计数据
  const weekStats = useMemo(() => {
    if (
      !weeklyTasks?.tasks ||
      !completedTasks?.tasks ||
      !timeEntries?.entries
    ) {
      return null;
    }

    const tasks = weeklyTasks.tasks;
    const completed = completedTasks.tasks;
    const entries = timeEntries.entries;

    // 任务统计
    const totalTasks = tasks.length;
    const completedCount = completed.length;
    const completionRate =
      totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    // 优先级分布
    const priorityStats = tasks.reduce(
      (acc, task) => {
        const priority = task.priority || "NONE";
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 状态分布
    const statusStats = tasks.reduce(
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

    // 每日完成任务数
    const dailyCompletion = completed.reduce(
      (acc, task) => {
        if (task.completedAt) {
          const day = new Date(task.completedAt).toLocaleDateString("zh-CN");
          acc[day] = (acc[day] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    // 逾期任务
    const overdueTasks = tasks.filter(
      (task) =>
        task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        task.status !== TaskStatus.DONE,
    );

    // 反馈统计
    const tasksWithFeedback = completed.filter(
      (task) => task.feedback && task.feedback.trim().length > 0,
    );
    const feedbackRate =
      completedCount > 0
        ? (tasksWithFeedback.length / completedCount) * 100
        : 0;

    return {
      totalTasks,
      completedCount,
      completionRate,
      priorityStats,
      statusStats,
      totalTimeSpent,
      dailyCompletion,
      overdueCount: overdueTasks.length,
      averageTasksPerDay: totalTasks / 7,
      averageCompletionPerDay: completedCount / 7,
      // 反馈统计
      tasksWithFeedback: tasksWithFeedback.length,
      feedbackRate,
    };
  }, [weeklyTasks, completedTasks, timeEntries]);

  // 导航到上一周/下一周
  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeek(newDate);
  };

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
          <title>每周回顾 | Infer GTD</title>
          <meta name="description" content="GTD每周回顾和分析" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和周导航 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">每周回顾</h1>
              <p className="mt-1 text-sm text-gray-600">
                回顾本周的任务完成情况和时间投入
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateWeek("prev")}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="上一周"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {formatWeekRange(weekRange.start, weekRange.end)}
                </div>
                <div className="text-sm text-gray-500">
                  {weekRange.start.getFullYear()}年第
                  {Math.ceil(
                    (weekRange.start.getTime() -
                      new Date(weekRange.start.getFullYear(), 0, 1).getTime()) /
                      (7 * 24 * 60 * 60 * 1000),
                  )}
                  周
                </div>
              </div>

              <button
                onClick={() => navigateWeek("next")}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="下一周"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 加载状态 */}
          {(statsLoading || tasksLoading) && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <SectionLoading />
            </div>
          )}

          {/* 周统计概览 */}
          {weekStats && (
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
                      <p className="text-sm font-medium text-gray-500">
                        完成率
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {weekStats.completionRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {weekStats.completedCount}/{weekStats.totalTasks} 个任务
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
                      <p className="text-sm font-medium text-gray-500">
                        时间投入
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.floor(weekStats.totalTimeSpent / 3600)}h
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(weekStats.totalTimeSpent)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 平均每日任务 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        日均任务
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {weekStats.averageTasksPerDay.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">
                        完成 {weekStats.averageCompletionPerDay.toFixed(1)}{" "}
                        个/天
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
                      <p className="text-sm font-medium text-gray-500">
                        逾期任务
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {weekStats.overdueCount}
                      </p>
                      <p className="text-xs text-gray-500">需要关注</p>
                    </div>
                  </div>
                </div>

                {/* 反馈统计 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        反馈率
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {weekStats.feedbackRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {weekStats.tasksWithFeedback}/{weekStats.completedCount}{" "}
                        个任务
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 详细分析 */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 任务状态分布 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    任务状态分布
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(weekStats.statusStats).map(
                      ([status, count]) => (
                        <div
                          key={status}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <div
                              className={`mr-3 h-3 w-3 rounded-full ${getStatusColor(status as TaskStatus)}`}
                            />
                            <span className="text-sm text-gray-700">
                              {getStatusLabel(status as TaskStatus)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {count}
                            </span>
                            <span className="text-xs text-gray-500">
                              (
                              {((count / weekStats.totalTasks) * 100).toFixed(
                                1,
                              )}
                              %)
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* 优先级分布 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    优先级分布
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(weekStats.priorityStats).map(
                      ([priority, count]) => (
                        <div
                          key={priority}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <div
                              className={`mr-3 h-3 w-3 rounded-full ${getPriorityColor(priority)}`}
                            />
                            <span className="text-sm text-gray-700">
                              {getPriorityLabel(priority)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {count}
                            </span>
                            <span className="text-xs text-gray-500">
                              (
                              {((count / weekStats.totalTasks) * 100).toFixed(
                                1,
                              )}
                              %)
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* 每日完成趋势 */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  每日完成趋势
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(weekRange.start);
                    date.setDate(date.getDate() + i);
                    const dateStr = date.toLocaleDateString("zh-CN");
                    const count = weekStats.dailyCompletion[dateStr] || 0;
                    const maxCount = Math.max(
                      ...Object.values(weekStats.dailyCompletion),
                      1,
                    );
                    const height = (count / maxCount) * 100;

                    return (
                      <div key={i} className="text-center">
                        <div className="mb-2 text-xs text-gray-500">
                          {date.toLocaleDateString("zh-CN", {
                            weekday: "short",
                          })}
                        </div>
                        <div className="relative h-20 rounded bg-gray-100">
                          <div
                            className="absolute bottom-0 w-full rounded bg-blue-500"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs font-medium text-gray-900">
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 本周亮点 */}
          {completedTasks?.tasks && completedTasks.tasks.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
                <CheckCircleIcon className="mr-2 h-5 w-5 text-green-500" />
                本周完成的任务
              </h3>
              <div className="space-y-4">
                {completedTasks.tasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="mt-1 line-clamp-1 text-xs text-gray-600">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {task.priority && (
                          <span
                            className={`rounded-full px-2 py-1 ${getPriorityBgColor(task.priority)}`}
                          >
                            {getPriorityLabel(task.priority)}
                          </span>
                        )}

                        {task.completedAt && (
                          <span>
                            {new Date(task.completedAt).toLocaleDateString(
                              "zh-CN",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 显示反馈内容 */}
                    {task.feedback && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-3">
                        <div>
                          <span className="text-xs font-medium text-gray-700">
                            任务反馈：
                          </span>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                            {task.feedback}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 改进建议 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 flex items-center text-lg font-medium text-gray-900">
              <LightBulbIcon className="mr-2 h-5 w-5 text-yellow-500" />
              改进建议
            </h3>
            <div className="space-y-3">
              {weekStats && (
                <>
                  {weekStats.completionRate < 70 && (
                    <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-3">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          任务完成率偏低
                        </p>
                        <p className="mt-1 text-xs text-yellow-700">
                          建议重新评估任务优先级，专注于最重要的任务
                        </p>
                      </div>
                    </div>
                  )}

                  {weekStats.overdueCount > 0 && (
                    <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          存在逾期任务
                        </p>
                        <p className="mt-1 text-xs text-red-700">
                          建议重新安排逾期任务的时间，或调整任务优先级
                        </p>
                      </div>
                    </div>
                  )}

                  {weekStats.totalTimeSpent < 3600 * 10 && (
                    <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
                      <ClockIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          时间投入较少
                        </p>
                        <p className="mt-1 text-xs text-blue-700">
                          考虑增加专注时间，或使用时间追踪功能更好地记录工作时间
                        </p>
                      </div>
                    </div>
                  )}

                  {weekStats.completionRate >= 80 &&
                    weekStats.overdueCount === 0 && (
                      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-3">
                        <TrophyIcon className="mt-0.5 h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            表现优秀！
                          </p>
                          <p className="mt-1 text-xs text-green-700">
                            本周任务完成情况良好，继续保持这种节奏
                          </p>
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
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

function getStatusColor(status: TaskStatus): string {
  const colors = {
    [TaskStatus.IDEA]: "bg-gray-400",
    [TaskStatus.TODO]: "bg-blue-400",
    [TaskStatus.IN_PROGRESS]: "bg-yellow-400",
    [TaskStatus.WAITING]: "bg-orange-400",
    [TaskStatus.DONE]: "bg-green-400",
    [TaskStatus.ARCHIVED]: "bg-gray-400",
  };
  return colors[status];
}

function getPriorityLabel(priority: string): string {
  const labels = {
    [Priority.LOW]: "低",
    [Priority.MEDIUM]: "中",
    [Priority.HIGH]: "高",
    [Priority.URGENT]: "紧急",
    NONE: "无",
  };
  return labels[priority as keyof typeof labels] || "无";
}

function getPriorityColor(priority: string): string {
  const colors = {
    [Priority.LOW]: "bg-green-400",
    [Priority.MEDIUM]: "bg-yellow-400",
    [Priority.HIGH]: "bg-orange-400",
    [Priority.URGENT]: "bg-red-400",
    NONE: "bg-gray-400",
  };
  return colors[priority as keyof typeof colors] || "bg-gray-400";
}

function getPriorityBgColor(priority: Priority): string {
  const colors = {
    [Priority.LOW]: "bg-green-100 text-green-800",
    [Priority.MEDIUM]: "bg-yellow-100 text-yellow-800",
    [Priority.HIGH]: "bg-orange-100 text-orange-800",
    [Priority.URGENT]: "bg-red-100 text-red-800",
  };
  return colors[priority];
}

export default WeeklyReviewPage;

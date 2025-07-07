import { type NextPage } from "next";
import Head from "next/head";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  BookOpenIcon,
  FolderIcon,
  TagIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { api } from "@/utils/api";

const AnalyticsPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");

  // 计算时间范围
  const dateRange = useMemo(() => {
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate: now };
  }, [timeRange]);

  // 获取各模块统计数据
  const { data: taskStats, isLoading: isLoadingTasks, refetch: refetchTasks } = api.task.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData }
  );

  const { data: noteStats, isLoading: isLoadingNotes, refetch: refetchNotes } = api.note.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData }
  );

  const { data: journalStats, isLoading: isLoadingJournals, refetch: refetchJournals } = api.journal.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData }
  );

  const { data: tagStats, isLoading: isLoadingTags, refetch: refetchTags } = api.tag.getStats.useQuery(
    undefined,
    { enabled: !!sessionData }
  );

  const { data: writingHabits, isLoading: isLoadingHabits, refetch: refetchHabits } = api.journal.getWritingHabits.useQuery(
    { days: timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365 },
    { enabled: !!sessionData }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetchTasks(),
      refetchNotes(),
      refetchJournals(),
      refetchTags(),
      refetchHabits(),
    ]);
  }, [refetchTasks, refetchNotes, refetchJournals, refetchTags, refetchHabits]);

  const isLoading = isLoadingTasks || isLoadingNotes || isLoadingJournals || isLoadingTags || isLoadingHabits;

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>统计分析 | Infer GTD</title>
          <meta name="description" content="生产力数据分析和洞察" />
        </Head>

        <div className="space-y-8">
          {/* 页面标题和时间范围选择 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">统计分析</h1>
              <p className="mt-2 text-gray-600">深入了解您的生产力数据和工作模式</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
                <option value="90d">最近 90 天</option>
                <option value="1y">最近 1 年</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">加载统计数据...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 概览卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 任务统计 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">任务总数</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {taskStats?.totalTasks ?? 0}
                      </p>
                      <p className="text-sm text-gray-600">
                        完成率 {taskStats?.completionRate ?? 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* 笔记统计 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">笔记总数</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {noteStats?.totalNotes ?? 0}
                      </p>
                      <p className="text-sm text-gray-600">
                        归档 {noteStats?.archivedNotes ?? 0} 篇
                      </p>
                    </div>
                  </div>
                </div>

                {/* 日记统计 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BookOpenIcon className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">日记条目</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {journalStats?.totalJournals ?? 0}
                      </p>
                      <p className="text-sm text-gray-600">
                        总计 {journalStats?.totalWords ?? 0} 字
                      </p>
                    </div>
                  </div>
                </div>

                {/* 时间统计 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">总时间</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {Math.round((taskStats?.totalTimeSpent ?? 0) / 60)}h
                      </p>
                      <p className="text-sm text-gray-600">
                        任务追踪时间
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 详细统计图表 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 任务状态分布 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">任务状态分布</h3>
                  <div className="space-y-3">
                    {taskStats?.statusCounts && Object.entries(taskStats.statusCounts).map(([status, count]) => {
                      const statusLabels: Record<string, string> = {
                        IDEA: "想法",
                        TODO: "待办",
                        IN_PROGRESS: "进行中",
                        WAITING: "等待中",
                        DONE: "已完成",
                        ARCHIVED: "已归档"
                      };
                      const statusColors: Record<string, string> = {
                        IDEA: "bg-gray-200",
                        TODO: "bg-blue-200",
                        IN_PROGRESS: "bg-yellow-200",
                        WAITING: "bg-orange-200",
                        DONE: "bg-green-200",
                        ARCHIVED: "bg-gray-300"
                      };
                      const percentage = taskStats.totalTasks > 0 ? (count / taskStats.totalTasks * 100).toFixed(1) : 0;

                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${statusColors[status]} mr-3`}></div>
                            <span className="text-sm text-gray-700">{statusLabels[status]}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 优先级分布 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">任务优先级分布</h3>
                  <div className="space-y-3">
                    {taskStats?.priorityCounts && Object.entries(taskStats.priorityCounts).map(([priority, count]) => {
                      const priorityLabels: Record<string, string> = {
                        LOW: "低优先级",
                        MEDIUM: "中优先级",
                        HIGH: "高优先级",
                        URGENT: "紧急"
                      };
                      const priorityColors: Record<string, string> = {
                        LOW: "bg-green-200",
                        MEDIUM: "bg-yellow-200",
                        HIGH: "bg-orange-200",
                        URGENT: "bg-red-200"
                      };
                      const percentage = taskStats.totalTasks > 0 ? (count / taskStats.totalTasks * 100).toFixed(1) : 0;

                      return (
                        <div key={priority} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${priorityColors[priority]} mr-3`}></div>
                            <span className="text-sm text-gray-700">{priorityLabels[priority]}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 写作习惯分析 */}
                {writingHabits && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">写作习惯分析</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">平均字数</span>
                        <span className="text-sm font-medium text-gray-900">{writingHabits.averageWords} 字/篇</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">写作一致性</span>
                        <span className="text-sm font-medium text-gray-900">{writingHabits.consistency.toFixed(1)} 篇/天</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">最活跃时间</span>
                        <span className="text-sm font-medium text-gray-900">{writingHabits.mostActiveHour}:00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">最活跃日期</span>
                        <span className="text-sm font-medium text-gray-900">
                          {["周日", "周一", "周二", "周三", "周四", "周五", "周六"][writingHabits.mostActiveDay]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 标签统计 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">标签使用统计</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">总标签数</span>
                      <span className="text-sm font-medium text-gray-900">{tagStats?.total ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">系统标签</span>
                      <span className="text-sm font-medium text-gray-900">{tagStats?.system ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">自定义标签</span>
                      <span className="text-sm font-medium text-gray-900">{tagStats?.custom ?? 0}</span>
                    </div>
                    {tagStats?.byType && Object.entries(tagStats.byType).map(([type, count]) => {
                      const typeLabels: Record<string, string> = {
                        CONTEXT: "上下文",
                        CATEGORY: "分类",
                        STATUS: "状态",
                        PRIORITY: "优先级"
                      };
                      return (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{typeLabels[type] ?? type}</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 生产力洞察 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">生产力洞察</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {journalStats?.consecutiveDays ?? 0}
                    </div>
                    <div className="text-sm text-gray-600">连续写作天数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {noteStats?.notesWithTasks ?? 0}
                    </div>
                    <div className="text-sm text-gray-600">关联任务的笔记</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {journalStats?.averageWordsPerJournal ?? 0}
                    </div>
                    <div className="text-sm text-gray-600">平均日记字数</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default AnalyticsPage;

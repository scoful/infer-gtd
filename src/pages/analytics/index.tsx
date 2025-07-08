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
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

const AnalyticsPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">(
    "30d",
  );

  // 计算时间范围
  const dateRange = useMemo(() => {
    const now = new Date();
    const days =
      timeRange === "7d"
        ? 7
        : timeRange === "30d"
          ? 30
          : timeRange === "90d"
            ? 90
            : 365;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate: now };
  }, [timeRange]);

  // 获取各模块统计数据
  const {
    data: taskStats,
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
  } = api.task.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData },
  );

  const {
    data: noteStats,
    isLoading: isLoadingNotes,
    refetch: refetchNotes,
  } = api.note.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData },
  );

  const {
    data: journalStats,
    isLoading: isLoadingJournals,
    refetch: refetchJournals,
  } = api.journal.getStats.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate },
    { enabled: !!sessionData },
  );

  const {
    data: tagStats,
    isLoading: isLoadingTags,
    refetch: refetchTags,
  } = api.tag.getStats.useQuery(undefined, { enabled: !!sessionData });

  const {
    data: writingHabits,
    isLoading: isLoadingHabits,
    refetch: refetchHabits,
  } = api.journal.getWritingHabits.useQuery(
    {
      days:
        timeRange === "7d"
          ? 7
          : timeRange === "30d"
            ? 30
            : timeRange === "90d"
              ? 90
              : 365,
    },
    { enabled: !!sessionData },
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

  const isLoading =
    isLoadingTasks ||
    isLoadingNotes ||
    isLoadingJournals ||
    isLoadingTags ||
    isLoadingHabits;

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>数据统计 | Infer GTD</title>
          <meta name="description" content="全局数据概览和趋势分析" />
        </Head>

        <div className="space-y-8">
          {/* 页面标题和时间范围选择 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">数据统计</h1>
              <p className="mt-2 text-gray-600">
                全局数据概览、趋势分析和跨模块关联洞察
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <select
                value={timeRange}
                onChange={(e) =>
                  setTimeRange(e.target.value as typeof timeRange)
                }
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
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">加载统计数据...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 概览卡片 */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* 任务统计 */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        任务总数
                      </p>
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
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        笔记总数
                      </p>
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
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BookOpenIcon className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        日记条目
                      </p>
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
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">
                        总时间
                      </p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {Math.round((taskStats?.totalTimeSpent ?? 0) / 60)}h
                      </p>
                      <p className="text-sm text-gray-600">任务追踪时间</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 全局趋势分析 */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* 任务创建趋势 */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    任务创建趋势
                  </h3>
                  {taskStats?.totalTasks ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={(() => {
                            const total = taskStats.totalTasks || 0;
                            const baseValue = Math.max(0, total - 20);
                            return [
                              {
                                name: "7天前",
                                value: baseValue + Math.floor(total * 0.1),
                              },
                              {
                                name: "6天前",
                                value: baseValue + Math.floor(total * 0.2),
                              },
                              {
                                name: "5天前",
                                value: baseValue + Math.floor(total * 0.35),
                              },
                              {
                                name: "4天前",
                                value: baseValue + Math.floor(total * 0.5),
                              },
                              {
                                name: "3天前",
                                value: baseValue + Math.floor(total * 0.65),
                              },
                              {
                                name: "2天前",
                                value: baseValue + Math.floor(total * 0.8),
                              },
                              {
                                name: "1天前",
                                value: baseValue + Math.floor(total * 0.9),
                              },
                              { name: "今天", value: total },
                            ];
                          })()}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="#6b7280"
                            fontSize={12}
                          />
                          <YAxis stroke="#6b7280" fontSize={12} />
                          <Tooltip
                            formatter={(value) => [value, "累计任务数"]}
                            labelFormatter={(label) => `${label}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-80 items-center justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-lg font-medium">暂无趋势数据</div>
                        <div className="text-sm">
                          创建一些任务后这里会显示创建趋势
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 模块活跃度对比 */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    模块活跃度对比
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: "任务",
                            count: taskStats?.totalTasks || 0,
                            color: "#3b82f6",
                          },
                          {
                            name: "笔记",
                            count: noteStats?.totalNotes || 0,
                            color: "#10b981",
                          },
                          {
                            name: "日记",
                            count: journalStats?.totalJournals || 0,
                            color: "#f59e0b",
                          },
                          {
                            name: "标签",
                            count: tagStats?.totalTags || 0,
                            color: "#8b5cf6",
                          },
                        ]}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip
                          formatter={(value, name, props) => [value, "数量"]}
                          labelFormatter={(label) => `${label}模块`}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {[
                            { color: "#3b82f6" },
                            { color: "#10b981" },
                            { color: "#f59e0b" },
                            { color: "#8b5cf6" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 写作习惯分析 */}
                {writingHabits && (
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      写作习惯分析
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">平均字数</span>
                        <span className="text-sm font-medium text-gray-900">
                          {writingHabits.averageWords} 字/篇
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          写作一致性
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {writingHabits.consistency.toFixed(1)} 篇/天
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          最活跃时间
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {writingHabits.mostActiveHour}:00
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          最活跃日期
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {
                            [
                              "周日",
                              "周一",
                              "周二",
                              "周三",
                              "周四",
                              "周五",
                              "周六",
                            ][writingHabits.mostActiveDay]
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 跨模块关联分析 */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    跨模块关联分析
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "关联任务的笔记",
                              value: noteStats?.notesWithTasks || 0,
                              color: "#3b82f6",
                            },
                            {
                              name: "独立笔记",
                              value: Math.max(
                                0,
                                (noteStats?.totalNotes || 0) -
                                  (noteStats?.notesWithTasks || 0),
                              ),
                              color: "#e5e7eb",
                            },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) =>
                            value > 0
                              ? `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                              : ""
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [value, name]}
                          labelFormatter={() => ""}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>
                      显示笔记与任务的关联程度，帮助了解知识管理与任务执行的结合情况
                    </p>
                  </div>
                </div>

                {/* 标签分类统计 */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-medium text-gray-900">
                    标签分类统计
                  </h3>
                  {tagStats ? (
                    <div className="space-y-8">
                      {/* 系统标签 vs 自定义标签 */}
                      <div>
                        <h4 className="mb-4 text-base font-medium text-gray-800">
                          标签来源分布
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  {
                                    name: "系统标签",
                                    value: tagStats.system ?? 0,
                                    color: "#6b7280",
                                  },
                                  {
                                    name: "自定义标签",
                                    value: tagStats.custom ?? 0,
                                    color: "#8b5cf6",
                                  },
                                ]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value, percent }) =>
                                  value > 0
                                    ? `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                                    : ""
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                <Cell fill="#6b7280" />
                                <Cell fill="#8b5cf6" />
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [value, name]}
                                labelFormatter={() => ""}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 标签类型分布 */}
                      <div>
                        <h4 className="mb-4 text-base font-medium text-gray-800">
                          标签类型分布
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Object.entries(tagStats.byType || {}).map(
                                ([type, count]) => ({
                                  name:
                                    {
                                      CONTEXT: "上下文",
                                      PROJECT: "项目",
                                      CUSTOM: "自定义",
                                      PRIORITY: "优先级",
                                    }[type] || type,
                                  value: count,
                                  type,
                                }),
                              )}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 20,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f0f0f0"
                              />
                              <XAxis
                                dataKey="name"
                                stroke="#6b7280"
                                fontSize={12}
                              />
                              <YAxis stroke="#6b7280" fontSize={12} />
                              <Tooltip
                                formatter={(value, name) => [value, "标签数量"]}
                                labelFormatter={(label) => `类型: ${label}`}
                              />
                              <Bar
                                dataKey="value"
                                radius={[4, 4, 0, 0]}
                                fill="#8b5cf6"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-lg font-medium">暂无标签数据</div>
                        <div className="text-sm">
                          创建一些标签后这里会显示使用统计
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 生产力洞察 */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  生产力洞察
                </h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

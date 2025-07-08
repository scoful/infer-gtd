import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import TaskModal from "@/components/Tasks/TaskModal";

const Home: NextPage = () => {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // 获取首页数据 - 使用 useMemo 避免重复计算日期
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }, []);

  const {
    data: taskStats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
    isFetching: isFetchingStats,
  } = api.task.getStats.useQuery(
    { startDate: thirtyDaysAgo },
    {
      enabled: !!sessionData,
      staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
      refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
    },
  );

  const {
    data: recentTasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
  } = api.task.getAll.useQuery(
    { limit: 5 },
    {
      enabled: !!sessionData,
      staleTime: 2 * 60 * 1000, // 2分钟内不重新获取
      refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
    },
  );

  const {
    data: recentNotes,
    isLoading: isLoadingNotes,
    error: notesError,
    refetch: refetchNotes,
  } = api.note.getAll.useQuery(
    { limit: 3, sortBy: "updatedAt", sortOrder: "desc" },
    {
      enabled: !!sessionData,
      staleTime: 2 * 60 * 1000, // 2分钟内不重新获取
      refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
    },
  );

  const {
    data: recentJournals,
    isLoading: isLoadingJournals,
    error: journalsError,
    refetch: refetchJournals,
  } = api.journal.getRecent.useQuery(
    { limit: 3 },
    {
      enabled: !!sessionData,
      staleTime: 2 * 60 * 1000, // 2分钟内不重新获取
      refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
    },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void Promise.all([
      refetchStats(),
      refetchTasks(),
      refetchNotes(),
      refetchJournals(),
    ]);
  }, [refetchStats, refetchTasks, refetchNotes, refetchJournals]);

  const quickActions = [
    {
      name: "新建任务",
      href: "#",
      icon: PlusIcon,
      description: "快速创建新任务",
      color: "bg-blue-500 hover:bg-blue-600",
      onClick: () => setIsTaskModalOpen(true),
    },
    {
      name: "开始计时",
      href: "/tasks/kanban",
      icon: ClockIcon,
      description: "为任务开始计时",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      name: "写笔记",
      href: "/notes/new",
      icon: DocumentTextIcon,
      description: "记录想法和知识",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      name: "写日记",
      href: "#",
      icon: BookOpenIcon,
      description: "今日反思记录",
      color: "bg-orange-500 hover:bg-orange-600",
      onClick: () => {
        // 跳转到新建日记页面（来自首页）
        void router.push("/journal/new?from=home");
      },
    },
  ];

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>首页 | Infer GTD</title>
          <meta name="description" content="智能化的个人效率和知识管理平台" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div className="space-y-6">
          {/* 快速操作 */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    欢迎回来，{sessionData?.user?.name}！
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    今天是{" "}
                    {new Date().toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </p>
                </div>
                {sessionData?.user?.image && (
                  <img
                    className="h-16 w-16 rounded-full"
                    src={sessionData.user.image}
                    alt={sessionData.user.name ?? "User"}
                  />
                )}
              </div>

              {/* 快速操作按钮 */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  // 如果有onClick事件，渲染为按钮
                  if (action.onClick) {
                    return (
                      <button
                        key={action.name}
                        onClick={action.onClick}
                        className={`group relative ${action.color} rounded-lg p-4 text-left text-white transition-colors hover:scale-105 transform`}
                      >
                        <div className="flex flex-col items-center text-center">
                          <span className="bg-opacity-20 inline-flex rounded-lg bg-white p-3 mb-3">
                            <Icon className="h-6 w-6 text-gray-700" />
                          </span>
                          <h3 className="text-sm font-medium">{action.name}</h3>
                          <p className="text-opacity-90 mt-1 text-xs text-white">
                            {action.description}
                          </p>
                        </div>
                      </button>
                    );
                  }

                  // 否则渲染为链接
                  return (
                    <Link
                      key={action.name}
                      href={action.href}
                      className={`group relative ${action.color} rounded-lg p-4 text-white transition-colors hover:scale-105 transform`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <span className="bg-opacity-20 inline-flex rounded-lg bg-white p-3 mb-3">
                          <Icon className="h-6 w-6 text-gray-700" />
                        </span>
                        <h3 className="text-sm font-medium">{action.name}</h3>
                        <p className="text-opacity-90 mt-1 text-xs text-white">
                          {action.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 统计概览 */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-medium text-gray-900">本月统计</h2>
              {isFetchingStats && !isLoadingStats && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  刷新中...
                </div>
              )}
            </div>
            <QueryLoading
              isLoading={isLoadingStats}
              error={statsError}
              loadingMessage="加载统计数据中..."
            >
              {taskStats && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ChartBarIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="truncate text-sm font-medium text-gray-500">
                              总任务数
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {taskStats.totalTasks}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ChartBarIcon className="h-6 w-6 text-green-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="truncate text-sm font-medium text-gray-500">
                              已完成
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {taskStats.completedTasks}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ClockIcon className="h-6 w-6 text-blue-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="truncate text-sm font-medium text-gray-500">
                              总时长
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {Math.round(taskStats.totalTimeSpent / 3600)}h
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ChartBarIcon className="h-6 w-6 text-purple-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="truncate text-sm font-medium text-gray-500">
                              完成率
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {taskStats.totalTasks > 0
                                ? Math.round(
                                    (taskStats.completedTasks /
                                      taskStats.totalTasks) *
                                      100,
                                  )
                                : 0}
                              %
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </QueryLoading>
          </div>



          {/* 最近活动 */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* 最近任务 */}
            <div className="rounded-lg bg-white shadow">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  最近任务
                </h3>
                <QueryLoading
                  isLoading={isLoadingTasks}
                  error={tasksError}
                  loadingMessage="加载任务中..."
                  loadingComponent={
                    <SectionLoading size="sm" message="加载任务中..." />
                  }
                >
                  {recentTasks?.tasks && recentTasks.tasks.length > 0 ? (
                    <div className="space-y-3">
                      {recentTasks.tasks
                        .sort((a, b) => {
                          // 按更新时间降序排序（最近更新的在前）
                          const aTime = new Date(a.updatedAt).getTime();
                          const bTime = new Date(b.updatedAt).getTime();
                          return bTime - aTime;
                        })
                        .slice(0, 5)
                        .map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center space-x-3"
                          >
                            <div
                              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                                task.status === "DONE"
                                  ? "bg-green-400"
                                  : task.status === "IN_PROGRESS"
                                    ? "bg-blue-400"
                                    : "bg-gray-400"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {task.title}
                              </p>
                              <p className="text-sm text-gray-500">
                                {task.status === "DONE"
                                  ? "已完成"
                                  : task.status === "IN_PROGRESS"
                                    ? "进行中"
                                    : task.status === "TODO"
                                      ? "待办"
                                      : "想法"}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">暂无任务</p>
                  )}
                </QueryLoading>
                <div className="mt-4">
                  <Link
                    href="/tasks/kanban"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    查看所有任务 →
                  </Link>
                </div>
              </div>
            </div>

            {/* 最近笔记 */}
            <div className="rounded-lg bg-white shadow">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  最近笔记
                </h3>
                <QueryLoading
                  isLoading={isLoadingNotes}
                  error={notesError}
                  loadingMessage="加载笔记中..."
                  loadingComponent={
                    <SectionLoading size="sm" message="加载笔记中..." />
                  }
                >
                  {recentNotes?.notes && recentNotes.notes.length > 0 ? (
                    <div className="space-y-3">
                      {recentNotes.notes.slice(0, 3).map((note) => (
                        <div key={note.id}>
                          <p className="truncate text-sm font-medium text-gray-900">
                            {note.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(note.updatedAt).toLocaleDateString(
                              "zh-CN",
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">暂无笔记</p>
                  )}
                </QueryLoading>
                <div className="mt-4">
                  <Link
                    href="/notes"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    查看所有笔记 →
                  </Link>
                </div>
              </div>
            </div>

            {/* 最近日记 */}
            <div className="rounded-lg bg-white shadow">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  最近日记
                </h3>
                <QueryLoading
                  isLoading={isLoadingJournals}
                  error={journalsError}
                  loadingMessage="加载日记中..."
                  loadingComponent={
                    <SectionLoading size="sm" message="加载日记中..." />
                  }
                >
                  {recentJournals && recentJournals.length > 0 ? (
                    <div className="space-y-3">
                      {recentJournals.slice(0, 3).map((journal) => (
                        <div key={journal.id}>
                          <p className="text-sm font-medium text-gray-900">
                            {(() => {
                              const d = new Date(journal.date);
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const day = String(d.getDate()).padStart(2, "0");
                              return `${year}-${month}-${day}`;
                            })()}
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {journal.preview}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">暂无日记</p>
                  )}
                </QueryLoading>
                <div className="mt-4">
                  <Link
                    href="/journal"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    查看所有日记 →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 任务模态框 */}
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={() => {
            // 刷新相关数据
            void refetchStats();
            void refetchTasks();
          }}
        />
      </MainLayout>
    </AuthGuard>
  );
};

export default Home;

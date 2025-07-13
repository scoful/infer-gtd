/**
 * 定时任务管理页面
 *
 * 功能：
 * 1. 查看定时任务状态
 * 2. 手动执行任务
 * 3. 查看执行历史
 */

import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import MainLayout from "@/components/Layout/MainLayout";
import AdminGuard from "@/components/Layout/AdminGuard";

function SchedulerPage() {
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // 获取调度器状态
  const {
    data: schedulerStatus,
    refetch: refetchStatus,
    error: statusError,
  } = api.scheduler.getStatus.useQuery();

  // 获取用户定时设置统计
  const { data: scheduleStats } = api.scheduler.getUserScheduleStats.useQuery();

  // 手动执行日记生成
  const executeJournalGeneration =
    api.scheduler.executeJournalGeneration.useMutation({
      onSuccess: (result) => {
        showSuccess(result.message);
        void refetchStatus();
      },
      onError: (error) => {
        showError(error.message || "执行失败");
      },
    });

  // 手动执行指定任务
  const executeTask = api.scheduler.executeTask.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void refetchStatus();
    },
    onError: (error) => {
      showError(error.message || "执行失败");
    },
  });

  // 处理手动执行日记生成
  const handleExecuteJournalGeneration = () => {
    const targetDate = new Date(selectedDate);
    executeJournalGeneration.mutate({ date: targetDate });
  };

  // 处理手动执行任务
  const handleExecuteTask = (taskId: string) => {
    executeTask.mutate({ taskId });
  };

  // 格式化下次执行时间
  const formatNextRun = (nextRun: string | null) => {
    if (!nextRun) return "未调度";

    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return "已过期";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}天后 (${date.toLocaleString()})`;
    } else if (diffHours > 0) {
      return `${diffHours}小时${diffMinutes}分钟后 (${date.toLocaleString()})`;
    } else {
      return `${diffMinutes}分钟后 (${date.toLocaleString()})`;
    }
  };

  // 加载状态
  if (!schedulerStatus && !statusError) {
    return (
      <>
        <Head>
          <title>定时任务管理 | Smart GTD</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">正在加载调度器状态...</p>
          </div>
        </div>
      </>
    );
  }

  // API 错误处理
  if (statusError) {
    return (
      <>
        <Head>
          <title>加载失败 | Smart GTD</title>
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-600" />
            <h1 className="mt-4 text-3xl font-bold text-gray-900">加载失败</h1>
            <p className="mt-2 text-gray-600">
              {statusError.message || "无法加载调度器状态"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>定时任务管理 | Smart GTD</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">定时任务管理</h1>
          <p className="mt-2 text-gray-600">
            管理和监控系统级定时任务的执行状态
          </p>
        </div>

        {/* 调度器状态概览 */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ClockIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  调度器状态
                </h2>
                <p className="text-sm text-gray-600">
                  系统级定时任务调度器运行状态
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {schedulerStatus?.data.isRunning ? (
                <>
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  <span className="font-medium text-green-600">运行中</span>
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  <span className="font-medium text-red-600">已停止</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 定时任务列表 */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900">定时任务列表</h3>
            <p className="mt-1 text-sm text-gray-500">
              系统中配置的所有自动化任务及其执行计划
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {schedulerStatus?.data.tasks.map((task) => (
              <div key={task.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-base font-medium text-gray-900">
                        {task.name}
                      </h4>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          task.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {task.enabled ? "启用" : "禁用"}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div>
                        执行频率:{" "}
                        <code className="rounded bg-gray-100 px-1">
                          {task.cronExpression}
                        </code>{" "}
                        (每分钟检查一次)
                      </div>
                      <div>下次执行: {formatNextRun(task.nextRun)}</div>
                      {task.id === "auto-generate-journal" &&
                        scheduleStats?.data && (
                          <div className="mt-2 rounded-md bg-blue-50 p-2">
                            <div className="mb-1 text-xs font-medium text-blue-800">
                              用户设置统计：
                            </div>
                            <div className="text-xs text-blue-700">
                              • 启用自动生成：{scheduleStats.data.enabledUsers}/
                              {scheduleStats.data.totalUsers} 人
                            </div>
                            {Object.keys(
                              scheduleStats.data.scheduleDistribution,
                            ).length > 1 && (
                              <div className="text-xs text-blue-700">
                                • 生成时间分布：
                                {Object.entries(
                                  scheduleStats.data.scheduleDistribution,
                                )
                                  .map(([time, count]) => `${time}(${count}人)`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleExecuteTask(task.id)}
                      disabled={executeTask.isPending}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <PlayIcon className="mr-1 h-4 w-4" />
                      手动执行
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 手动操作区域 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-medium text-gray-900">手动操作</h3>
          <p className="mb-4 text-sm text-gray-500">
            管理员可以手动触发任务执行，不受用户设置和时间限制
          </p>

          <div className="space-y-4">
            {/* 手动生成日记 */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700"
                >
                  为指定日期强制生成日记
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  忽略用户设置，直接为选定日期生成日记内容
                </p>
                <div className="mt-1 flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    id="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleExecuteJournalGeneration}
                disabled={executeJournalGeneration.isPending}
                className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {executeJournalGeneration.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    生成中...
                  </>
                ) : (
                  <>
                    <PlayIcon className="mr-2 h-4 w-4" />
                    强制生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SchedulerPageWithLayout() {
  return (
    <AdminGuard>
      <MainLayout>
        <SchedulerPage />
      </MainLayout>
    </AdminGuard>
  );
}

import { type NextPage } from "next";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  BookOpenIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import DateNavigation from "@/components/Journal/DateNavigation";
import MarkdownRenderer from "@/components/UI/MarkdownRenderer";
import { api } from "@/utils/api";
import { usePageRefresh } from "@/hooks/usePageRefresh";

const JournalPage: NextPage = () => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // 手动刷新（导航栏点击）

  // 获取当前日期的日记
  const {
    data: currentJournal,
    isLoading,
    isFetching: isFetchingCurrentJournal,
    refetch: refetchCurrentJournal,
  } = api.journal.getByDate.useQuery(
    { date: currentDate },
    {
      staleTime: 30 * 1000, // 30秒缓存
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  // 获取最近的日记列表（用于显示有日记的日期）
  const {
    data: recentJournals,
    isFetching: isFetchingRecentJournals,
    refetch: refetchRecentJournals,
  } = api.journal.getRecent.useQuery(
    { limit: 30 },
    {
      staleTime: 30 * 1000, // 30秒缓存
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  // 构建有日记的日期集合
  const hasJournalDates = new Set(
    recentJournals?.map((journal) => {
      // 使用本地时区的日期，避免 UTC 时区转换导致的日期偏移
      const date = new Date(journal.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }) || [],
  );

  // 计算刷新状态
  const isFetching = isFetchingCurrentJournal || isFetchingRecentJournals;
  const isRealInitialLoading = isLoading;
  const isDataRefreshing =
    isFetching && !isRealInitialLoading && isManualRefreshing;

  // 监听查询状态变化，在刷新完成后重置标志
  useEffect(() => {
    if (isManualRefreshing && !isFetching) {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, isFetching]);

  // 刷新所有数据
  const refetchAll = async () => {
    setIsManualRefreshing(true); // 标记为手动刷新
    await Promise.all([refetchCurrentJournal(), refetchRecentJournals()]);
  };

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetchAll();
  }, [refetchCurrentJournal, refetchRecentJournals]);

  // 监听路由变化，当返回到日记首页时刷新数据
  useEffect(() => {
    if (router.isReady) {
      void refetchCurrentJournal();
      void refetchRecentJournals();
    }
  }, [
    router.isReady,
    router.asPath,
    refetchCurrentJournal,
    refetchRecentJournals,
  ]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleEdit = () => {
    // 检查是否为今天的日期
    const today = new Date();
    const isToday = currentDate.toDateString() === today.toDateString();

    if (!isToday) {
      // 如果不是今天，提示用户只能为今天创建日记
      alert(
        "只能为今天创建新日记。如需查看或编辑其他日期的日记，请从日记列表中选择。",
      );
      return;
    }

    // 如果当前日期已有日记，跳转到编辑页面
    if (currentJournal) {
      void router.push(`/journal/${currentJournal.id}?edit=true&from=index`);
    } else {
      // 如果当前日期没有日记，跳转到新建日记页面
      void router.push("/journal/new?from=index");
    }
  };

  const goToToday = () => {
    // 检查今天是否已有日记
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    if (hasJournalDates.has(todayKey)) {
      // 如果今天已有日记，跳转到日记首页并设置为今天
      setCurrentDate(today);
    } else {
      // 如果今天没有日记，跳转到新建日记页面（来自首页）
      void router.push("/journal/new?from=index");
    }
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>日记流 | Infer GTD</title>
          <meta name="description" content="每日反思和记录" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和快速操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">日记流</h1>
                {isDataRefreshing && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">每日反思和记录</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={goToToday}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                写今日日记
              </button>
            </div>
          </div>

          {/* 日期导航 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <DateNavigation
              currentDate={currentDate}
              onDateChange={handleDateChange}
              hasJournalDates={hasJournalDates}
            />
          </div>

          {/* 日记内容区域 */}
          {isLoading ? (
            <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-white">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">加载日记中...</p>
              </div>
            </div>
          ) : currentJournal ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              {/* 日记头部 */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center space-x-4">
                  {currentJournal.updatedAt !== currentJournal.createdAt && (
                    <div className="flex items-center text-sm text-gray-500">
                      <ClockIcon className="mr-1 h-4 w-4" />
                      更新于{" "}
                      {new Date(currentJournal.updatedAt).toLocaleString(
                        "zh-CN",
                        {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {currentJournal ? "编辑" : "创建"}
                </button>
              </div>

              {/* 日记内容 */}
              <div className="p-6">
                <MarkdownRenderer content={currentJournal.content} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
              <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                这一天还没有日记
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                开始记录这一天的思考和感悟吧
              </p>
              <div className="mt-6">
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  开始写日记
                </button>
              </div>
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default JournalPage;

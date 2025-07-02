import { type NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
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
import JournalEditor from "@/components/Journal/JournalEditor";
import MarkdownRenderer from "@/components/UI/MarkdownRenderer";
import { api } from "@/utils/api";
import { usePageRefresh } from "@/hooks/usePageRefresh";

const JournalPage: NextPage = () => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);

  // 获取当前日期的日记
  const {
    data: currentJournal,
    isLoading,
    refetch,
  } = api.journal.getByDate.useQuery({ date: currentDate });

  // 获取最近的日记列表（用于显示有日记的日期）
  const { data: recentJournals } = api.journal.getRecent.useQuery({
    limit: 30,
  });

  // 构建有日记的日期集合
  const hasJournalDates = new Set(
    recentJournals?.map((journal) =>
      new Date(journal.date).toISOString().split("T")[0]
    ) || []
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    void refetch();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const goToToday = () => {
    void router.push("/journal/today");
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>日记 | Infer GTD</title>
          <meta name="description" content="每日反思和记录" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和快速操作 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">日记</h1>
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
          ) : isEditing ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              <JournalEditor
                date={currentDate}
                onSave={handleSave}
                onCancel={handleCancelEdit}
              />
            </div>
          ) : currentJournal ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              {/* 日记头部 */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="mr-1 h-4 w-4" />
                    {new Date(currentJournal.createdAt).toLocaleDateString(
                      "zh-CN"
                    )}
                  </div>
                  {currentJournal.updatedAt !== currentJournal.createdAt && (
                    <div className="flex items-center text-sm text-gray-500">
                      <ClockIcon className="mr-1 h-4 w-4" />
                      更新于{" "}
                      {new Date(currentJournal.updatedAt).toLocaleDateString(
                        "zh-CN"
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  编辑
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

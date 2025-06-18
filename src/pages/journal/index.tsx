import { type NextPage } from "next";
import Head from "next/head";
import { BookOpenIcon, PlusIcon } from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";

const JournalPage: NextPage = () => {
  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>日志 | Smart GTD</title>
          <meta name="description" content="每日反思和记录" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">日志</h1>
              <p className="text-sm text-gray-600 mt-1">
                每日反思和记录
              </p>
            </div>

            <button
              disabled
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-400 cursor-not-allowed"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              新建日志
            </button>
          </div>

          {/* 开发中提示 */}
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">日志功能开发中</h3>
            <p className="mt-1 text-sm text-gray-500">
              日志记录功能正在开发中，敬请期待
            </p>
            <div className="mt-6">
              <div className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white">
                即将推出
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default JournalPage;

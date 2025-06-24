import { type NextPage } from "next";
import Head from "next/head";
import { ChartBarIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { usePageRefresh } from "@/hooks/usePageRefresh";

const AnalyticsPage: NextPage = () => {
  // 注册页面刷新函数（占位符页面暂时无需刷新数据）
  usePageRefresh(() => {
    // 当统计功能实现后，这里将添加数据刷新逻辑
    console.log("统计页面刷新");
  }, []);

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>统计 | Infer GTD</title>
          <meta name="description" content="数据分析和洞察" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">统计</h1>
              <p className="mt-1 text-sm text-gray-600">数据分析和洞察</p>
            </div>

            <button
              disabled
              className="inline-flex cursor-not-allowed items-center rounded-md border border-transparent bg-gray-400 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              <ArrowTrendingUpIcon className="mr-2 h-4 w-4" />
              生成报告
            </button>
          </div>

          {/* 开发中提示 */}
          <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              统计功能开发中
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              数据分析和统计功能正在开发中，敬请期待
            </p>
            <div className="mt-6">
              <div className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                即将推出
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default AnalyticsPage;

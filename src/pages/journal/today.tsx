import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import JournalEditor from "@/components/Journal/JournalEditor";
import { usePageRefresh } from "@/hooks/usePageRefresh";

const TodayJournalPage: NextPage = () => {
  const router = useRouter();
  const today = new Date();

  // 注册页面刷新函数
  usePageRefresh(() => {
    // 刷新页面时重新加载编辑器
    window.location.reload();
  }, []);

  const handleSave = () => {
    // 保存成功后可以选择跳转到日记列表或留在当前页面
    // 这里选择留在当前页面，让用户继续编辑
  };

  const handleCancel = () => {
    // 返回日记首页
    void router.push("/journal");
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>今日日记 | Infer GTD</title>
          <meta name="description" content="记录今天的思考和感悟" />
        </Head>

        <div className="flex h-full flex-col">
          {/* 页面标题 */}
          <div className="border-b border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="mr-1 h-4 w-4" />
                  返回
                </button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    今日日记
                  </h1>
                  <p className="text-sm text-gray-500">
                    记录今天的思考、学习和感悟
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 日记编辑器 */}
          <div className="flex-1 overflow-hidden">
            <JournalEditor
              date={today}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default TodayJournalPage;

import { type NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

const NotificationDemo: NextPage = () => {
  const {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
    clearByType,
  } = useGlobalNotifications();

  // 注意：由于使用全局通知系统，位置设置功能在此演示页面中不再可用
  // 位置设置需要在应用级别的 NotificationProvider 中配置

  const handleShowSuccess = () => {
    showSuccess("操作成功完成！", {
      title: "成功",
      duration: 3000,
    });
  };

  const handleShowError = () => {
    showError("发生了一个错误，请重试", {
      title: "错误",
      duration: 5000,
    });
  };

  const handleShowWarning = () => {
    showWarning("这是一个警告消息", {
      title: "警告",
      duration: 4000,
    });
  };

  const handleShowInfo = () => {
    showInfo("这是一条信息提示", {
      title: "信息",
      duration: 3000,
    });
  };

  const handleShowPersistent = () => {
    showError("这是一个持久化通知，不会自动消失，但可以手动关闭", {
      title: "持久化通知",
      persistent: true,
    });
  };

  const handleShowWithAction = () => {
    showInfo("点击下方按钮执行操作", {
      title: "带操作的通知",
      action: {
        label: "立即执行",
        onClick: () => {
          showSuccess("操作已执行！");
        },
      },
    });
  };

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>通知系统演示 | Infer GTD</title>
          <meta name="description" content="通知系统功能演示" />
        </Head>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">通知系统演示</h1>
            <p className="mt-1 text-sm text-gray-500">
              测试各种类型的通知和功能
            </p>
          </div>

          {/* 全局通知系统说明 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-medium text-gray-900">
              全局通知系统
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• 当前使用全局通知系统，所有通知都会显示在页面顶部居中位置</p>
              <p>• 通知位置在应用级别的 NotificationProvider 中统一配置</p>
              <p>• 所有页面和组件共享同一个通知实例，确保用户体验一致</p>
            </div>
          </div>

          {/* 基础通知 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-medium text-gray-900">
              基础通知类型
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <button
                onClick={handleShowSuccess}
                className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                成功通知
              </button>
              <button
                onClick={handleShowError}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                错误通知
              </button>
              <button
                onClick={handleShowWarning}
                className="rounded-md bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
              >
                警告通知
              </button>
              <button
                onClick={handleShowInfo}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                信息通知
              </button>
            </div>
          </div>

          {/* 高级功能 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-medium text-gray-900">高级功能</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={handleShowPersistent}
                  className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
                >
                  持久化通知
                </button>
                <button
                  onClick={handleShowWithAction}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  带操作的通知
                </button>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  • <strong>持久化通知</strong>：不会自动消失，但可以点击 ✕
                  手动关闭
                </p>
                <p>
                  • <strong>带操作的通知</strong>：包含可点击的操作按钮
                </p>
              </div>
            </div>
          </div>

          {/* 管理功能 */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-medium text-gray-900">通知管理</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <button
                onClick={() => clearByType("success")}
                className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                清除成功通知
              </button>
              <button
                onClick={() => clearByType("error")}
                className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                清除错误通知
              </button>
              <button
                onClick={clearAll}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                清除所有通知
              </button>
              <div className="flex items-center text-sm text-gray-500">
                通知管理功能已集成到全局系统
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default NotificationDemo;

/**
 * 管理员权限守卫组件
 * 
 * 功能：
 * 1. 检查用户是否已登录
 * 2. 检查用户是否具有管理员权限
 * 3. 未授权时显示错误页面或重定向
 */

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export default function AdminGuard({ 
  children, 
  fallback,
  redirectTo = "/" 
}: AdminGuardProps) {
  const router = useRouter();
  const { data: sessionData, status: sessionStatus } = useSession();

  // 获取用户设置以检查管理员权限
  const { 
    data: userSettings, 
    isLoading: isLoadingSettings,
    error: settingsError 
  } = api.userSettings.get.useQuery(
    {},
    { 
      enabled: !!sessionData?.user,
      retry: false, // 不重试，避免多次权限检查
    }
  );

  // 检查是否为管理员
  const isAdmin = userSettings?.data?.role === "admin";

  // 处理重定向
  useEffect(() => {
    if (sessionStatus === "loading" || isLoadingSettings) {
      return; // 还在加载中
    }

    // 未登录，重定向到首页
    if (sessionStatus === "unauthenticated") {
      void router.replace(redirectTo);
      return;
    }

    // 已登录但不是管理员，重定向到首页
    if (sessionData && !isAdmin && !isLoadingSettings) {
      void router.replace(redirectTo);
      return;
    }
  }, [sessionStatus, isAdmin, isLoadingSettings, router, redirectTo, sessionData]);

  // 加载状态
  if (sessionStatus === "loading" || isLoadingSettings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">正在验证权限...</p>
        </div>
      </div>
    );
  }

  // 未登录
  if (sessionStatus === "unauthenticated") {
    return fallback || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-yellow-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">需要登录</h1>
          <p className="mt-2 text-gray-600">
            请先登录后再访问此页面
          </p>
        </div>
      </div>
    );
  }

  // 已登录但权限不足
  if (sessionData && !isAdmin) {
    return fallback || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">访问被拒绝</h1>
          <p className="mt-2 text-gray-600">
            您需要管理员权限才能访问此页面
          </p>
          <button
            onClick={() => router.push(redirectTo)}
            className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // API 调用错误（可能是权限问题）
  if (settingsError) {
    return fallback || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">权限验证失败</h1>
          <p className="mt-2 text-gray-600">
            无法验证您的权限，请稍后重试
          </p>
          <div className="mt-4 space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              重新加载
            </button>
            <button
              onClick={() => router.push(redirectTo)}
              className="inline-flex items-center rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 权限验证通过，渲染子组件
  return <>{children}</>;
}

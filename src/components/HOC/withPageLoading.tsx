import React from "react";
import { type TRPCClientError } from "@trpc/client";
import { type AppRouter } from "@/server/api/root";
import { PageLoading, QueryLoading } from "@/components/UI";

interface LoadingState {
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
  enabled?: boolean;
}

interface WithPageLoadingProps {
  loadingStates: LoadingState[];
  loadingMessage?: string;
  errorMessage?: string;
  showIndividualErrors?: boolean;
}

/**
 * 高阶组件：自动处理页面级loading状态
 * 当任何查询处于loading状态时显示页面loading
 * 当有错误时显示错误信息
 */
export function withPageLoading<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    loadingMessage?: string;
    errorMessage?: string;
    showIndividualErrors?: boolean;
  } = {},
) {
  const {
    loadingMessage = "加载页面数据中...",
    errorMessage = "加载失败",
    showIndividualErrors = false,
  } = options;

  return function WithPageLoadingComponent(props: P & WithPageLoadingProps) {
    const { loadingStates, ...restProps } = props;

    // 过滤启用的查询
    const enabledStates = loadingStates.filter(
      (state) => state.enabled !== false,
    );

    // 检查loading状态
    const isAnyLoading = enabledStates.some((state) => state.isLoading);
    const hasAnyError = enabledStates.some((state) => state.error);
    const errors = enabledStates
      .filter((state) => state.error)
      .map((state) => state.error);

    // 如果有loading状态，显示页面loading
    if (isAnyLoading) {
      return <PageLoading message={loadingMessage} />;
    }

    // 如果有错误，显示错误信息
    if (hasAnyError) {
      if (showIndividualErrors) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="max-w-md text-center">
              <h2 className="mb-4 text-lg font-medium text-gray-900">
                {errorMessage}
              </h2>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className="rounded-md bg-red-50 p-3 text-sm text-red-600"
                  >
                    {error?.message || "未知错误"}
                  </div>
                ))}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                重新加载
              </button>
            </div>
          </div>
        );
      } else {
        return (
          <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="mb-2 text-lg font-medium text-gray-900">
                {errorMessage}
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                {errors[0]?.message || "请检查网络连接后重试"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                重新加载
              </button>
            </div>
          </div>
        );
      }
    }

    // 渲染正常组件
    return <WrappedComponent {...(restProps as P)} />;
  };
}

/**
 * Hook版本：用于函数组件内部使用
 */
export function usePageLoadingState(loadingStates: LoadingState[]) {
  const enabledStates = loadingStates.filter(
    (state) => state.enabled !== false,
  );

  const isAnyLoading = enabledStates.some((state) => state.isLoading);
  const hasAnyError = enabledStates.some((state) => state.error);
  const errors = enabledStates
    .filter((state) => state.error)
    .map((state) => state.error);
  const isReady =
    enabledStates.length > 0 &&
    enabledStates.every((state) => !state.isLoading && !state.error);

  return {
    isAnyLoading,
    hasAnyError,
    errors,
    isReady,
    enabledCount: enabledStates.length,
    loadingCount: enabledStates.filter((state) => state.isLoading).length,
    errorCount: errors.length,
  };
}

/**
 * 渲染函数：根据loading状态渲染不同内容
 */
export function renderWithLoadingState(
  loadingStates: LoadingState[],
  options: {
    loadingComponent?: React.ReactNode;
    errorComponent?: React.ReactNode;
    loadingMessage?: string;
    errorMessage?: string;
  } = {},
) {
  const {
    loadingComponent,
    errorComponent,
    loadingMessage = "加载中...",
    errorMessage = "加载失败",
  } = options;

  const { isAnyLoading, hasAnyError, errors } =
    usePageLoadingState(loadingStates);

  if (isAnyLoading) {
    return loadingComponent || <PageLoading message={loadingMessage} />;
  }

  if (hasAnyError) {
    return (
      errorComponent || (
        <div className="p-4 text-center text-red-600">
          <p className="text-sm font-medium">{errorMessage}</p>
          <p className="mt-1 text-xs">{errors[0]?.message}</p>
        </div>
      )
    );
  }

  return null; // 表示可以渲染正常内容
}

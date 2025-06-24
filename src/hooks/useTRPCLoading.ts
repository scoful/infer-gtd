import { type TRPCClientError } from "@trpc/client";
import { type AppRouter } from "@/server/api/root";

/**
 * 自定义Hook：简化tRPC查询状态管理
 * 提供统一的loading、error和data状态处理
 */
export function useTRPCQuery<T>(queryResult: {
  data: T | undefined;
  isLoading: boolean;
  error: TRPCClientError<AppRouter> | null;
}) {
  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    hasData: !!queryResult.data,
    hasError: !!queryResult.error,
    isReady: !queryResult.isLoading && !queryResult.error,
  };
}

/**
 * 自定义Hook：简化tRPC变更状态管理
 * 提供统一的pending、error和success状态处理
 */
export function useTRPCMutation<T>(mutationResult: {
  isPending: boolean;
  error: TRPCClientError<AppRouter> | null;
  isSuccess: boolean;
  data: T | undefined;
}) {
  return {
    isPending: mutationResult.isPending,
    error: mutationResult.error,
    isSuccess: mutationResult.isSuccess,
    data: mutationResult.data,
    hasError: !!mutationResult.error,
    isIdle:
      !mutationResult.isPending &&
      !mutationResult.isSuccess &&
      !mutationResult.error,
  };
}

/**
 * 自定义Hook：批量查询状态管理
 * 用于管理多个查询的整体loading状态
 */
export function useBatchTRPCQueries(
  queries: Array<{
    isLoading: boolean;
    error: TRPCClientError<AppRouter> | null;
  }>,
) {
  const isAnyLoading = queries.some((q) => q.isLoading);
  const hasAnyError = queries.some((q) => q.error);
  const errors = queries.filter((q) => q.error).map((q) => q.error);
  const allReady = queries.every((q) => !q.isLoading && !q.error);

  return {
    isAnyLoading,
    hasAnyError,
    errors,
    allReady,
    loadingCount: queries.filter((q) => q.isLoading).length,
    errorCount: errors.length,
  };
}

/**
 * 自定义Hook：页面级数据加载状态管理
 * 适用于需要等待多个查询完成的页面
 */
export function usePageDataLoading(
  queries: Array<{
    isLoading: boolean;
    error: TRPCClientError<AppRouter> | null;
    enabled?: boolean;
  }>,
) {
  // 只考虑启用的查询
  const enabledQueries = queries.filter((q) => q.enabled !== false);

  const isPageLoading = enabledQueries.some((q) => q.isLoading);
  const hasPageError = enabledQueries.some((q) => q.error);
  const pageErrors = enabledQueries.filter((q) => q.error).map((q) => q.error);
  const isPageReady =
    enabledQueries.length > 0 &&
    enabledQueries.every((q) => !q.isLoading && !q.error);

  return {
    isPageLoading,
    hasPageError,
    pageErrors,
    isPageReady,
    enabledQueryCount: enabledQueries.length,
    loadingQueryCount: enabledQueries.filter((q) => q.isLoading).length,
  };
}

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useRefresh } from '@/contexts/RefreshContext';

/**
 * 通用的页面刷新 Hook
 * 自动注册当前页面的刷新函数到全局上下文
 *
 * @param refreshFn 页面的刷新函数
 * @param deps 依赖数组，当依赖变化时重新注册刷新函数
 */
export function usePageRefresh(refreshFn: () => void, deps: React.DependencyList = []) {
  const router = useRouter();
  const { registerPageRefresh, unregisterPageRefresh } = useRefresh();

  // 使用 useCallback 包装刷新函数，避免不必要的重新注册
  const stableRefreshFn = useCallback(refreshFn, deps);

  useEffect(() => {
    const currentPath = router.asPath;

    // 注册当前页面的刷新函数
    registerPageRefresh(currentPath, stableRefreshFn);

    // 清理函数：组件卸载时取消注册
    return () => {
      unregisterPageRefresh(currentPath);
    };
  }, [router.asPath, registerPageRefresh, unregisterPageRefresh, stableRefreshFn]);
}

import React, { createContext, useContext, useCallback, useRef } from "react";

interface RefreshContextType {
  refreshPage: (path: string) => void;
  registerPageRefresh: (path: string, refreshFn: () => void) => void;
  unregisterPageRefresh: (path: string) => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  // 使用 useRef 而不是 useState 来避免无限循环
  const pageRefreshFunctions = useRef<Record<string, () => void>>({});

  const refreshPage = useCallback((path: string) => {
    const refreshFn = pageRefreshFunctions.current[path];
    if (refreshFn) {
      refreshFn();
    }
  }, []); // 空依赖数组，函数永远不会重新创建

  const registerPageRefresh = useCallback(
    (path: string, refreshFn: () => void) => {
      pageRefreshFunctions.current[path] = refreshFn;
    },
    [],
  );

  const unregisterPageRefresh = useCallback((path: string) => {
    delete pageRefreshFunctions.current[path];
  }, []);

  const value = {
    refreshPage,
    registerPageRefresh,
    unregisterPageRefresh,
  };

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
}

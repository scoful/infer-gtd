import { useState, useEffect } from "react";

const SIDEBAR_STORAGE_KEY = "smart-gtd-sidebar-collapsed";

export function useSidebarState() {
  // 初始状态尝试从 localStorage 同步读取，避免状态跳跃
  const getInitialState = () => {
    if (typeof window === "undefined") return false; // SSR 时默认展开
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // 确保客户端状态同步，并在必要时重新同步 localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        const storedValue = stored !== null ? JSON.parse(stored) : false;
        // 只有当存储的值与当前状态不同时才更新
        if (storedValue !== isCollapsed) {
          setIsCollapsed(storedValue);
        }
      } catch (error) {
        console.warn("Failed to sync sidebar state from localStorage:", error);
      }
    }
    setIsLoaded(true);
  }, []);

  // 保存状态到 localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed));
      } catch (error) {
        console.warn("Failed to save sidebar state to localStorage:", error);
      }
    }
  }, [isCollapsed, isLoaded]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const collapseSidebar = () => {
    setIsCollapsed(true);
  };

  const expandSidebar = () => {
    setIsCollapsed(false);
  };

  return {
    isCollapsed,
    isLoaded,
    toggleSidebar,
    collapseSidebar,
    expandSidebar,
  };
}

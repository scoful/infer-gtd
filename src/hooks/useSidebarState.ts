import { useState, useEffect } from "react";

const SIDEBAR_STORAGE_KEY = "smart-gtd-sidebar-collapsed";

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载初始状态
  useEffect(() => {
    // 使用 requestAnimationFrame 确保在下一帧更新状态，避免闪烁
    const loadState = () => {
      try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored !== null) {
          setIsCollapsed(JSON.parse(stored));
        }
      } catch (error) {
        console.warn("Failed to load sidebar state from localStorage:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    requestAnimationFrame(loadState);
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
    setIsCollapsed(prev => !prev);
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

import { useCallback, useEffect } from "react";
import { useRouter } from "next/router";

// 快捷键配置类型
export interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
  disabled?: boolean;
  preventDefault?: boolean;
}

// 全局快捷键配置
export const GLOBAL_SHORTCUTS = {
  // 导航快捷键
  SEARCH: {
    key: "k",
    ctrlKey: true,
    metaKey: true, // 支持 Mac 的 Cmd 键
    description: "打开搜索",
    preventDefault: true,
  },

  // 操作快捷键
  NEW_TASK: {
    key: "t",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "新建任务",
    preventDefault: true,
  },
  NEW_NOTE: {
    key: "n",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "新建笔记",
    preventDefault: true,
  },
  NEW_JOURNAL: {
    key: "j",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "新建日记",
    preventDefault: true,
  },

  // 快速操作
  QUICK_CAPTURE: {
    key: "q",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "快速捕获想法",
    preventDefault: true,
  },
  TODAY_JOURNAL: {
    key: "d",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "今日日记",
    preventDefault: true,
  },

  // 帮助
  HELP: {
    key: "h",
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    description: "显示快捷键帮助",
    preventDefault: true,
  },
} as const;

// 检查快捷键是否匹配
function isShortcutMatch(
  event: KeyboardEvent,
  shortcut: Partial<ShortcutConfig>,
): boolean {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key?.toLowerCase();

  if (key !== shortcutKey) return false;

  // 检查修饰键 - 必须完全匹配
  const ctrlMetaMatch =
    shortcut.ctrlKey || shortcut.metaKey
      ? event.ctrlKey || event.metaKey
      : !event.ctrlKey && !event.metaKey;

  const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
  const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

  return ctrlMetaMatch && shiftMatch && altMatch;
}

// 全局快捷键 Hook
export function useGlobalShortcuts() {
  const router = useRouter();

  // 导航函数
  const navigateTo = useCallback(
    (path: string) => {
      void router.push(path);
    },
    [router],
  );

  // 快捷键处理函数
  const handleShortcut = useCallback(
    (shortcutKey: keyof typeof GLOBAL_SHORTCUTS) => {
      switch (shortcutKey) {
        case "SEARCH":
          // 触发搜索框聚焦（通过自定义事件）
          window.dispatchEvent(new CustomEvent("global-shortcut-search"));
          break;
        case "NEW_TASK":
          window.dispatchEvent(new CustomEvent("global-shortcut-new-task"));
          break;
        case "NEW_NOTE":
          window.dispatchEvent(new CustomEvent("global-shortcut-new-note"));
          break;
        case "NEW_JOURNAL":
          window.dispatchEvent(new CustomEvent("global-shortcut-new-journal"));
          break;
        case "QUICK_CAPTURE":
          navigateTo("/stream");
          break;
        case "TODAY_JOURNAL":
          navigateTo("/journal");
          break;
        case "HELP":
          window.dispatchEvent(new CustomEvent("global-shortcut-help"));
          break;
      }
    },
    [navigateTo],
  );

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 忽略在输入框、文本域等元素中的快捷键
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest(".w-md-editor"); // Markdown编辑器

      // 对于某些快捷键，即使在输入框中也要响应
      const alwaysActiveShortcuts = ["SEARCH", "HELP"];

      for (const [key, shortcut] of Object.entries(GLOBAL_SHORTCUTS)) {
        if (isShortcutMatch(event, shortcut)) {
          // 检查是否应该忽略输入框中的快捷键
          if (isInputElement && !alwaysActiveShortcuts.includes(key)) {
            continue;
          }

          if (shortcut.preventDefault) {
            event.preventDefault();
          }

          handleShortcut(key as keyof typeof GLOBAL_SHORTCUTS);
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleShortcut]);

  return {
    shortcuts: GLOBAL_SHORTCUTS,
    handleShortcut,
  };
}

// 获取快捷键显示文本的工具函数
export function getShortcutText(shortcut: Partial<ShortcutConfig>): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    // 根据平台显示不同的修饰键
    const isMac =
      typeof navigator !== "undefined" &&
      navigator.platform.toUpperCase().includes("MAC");
    parts.push(isMac ? "⌘" : "Ctrl");
  }

  if (shortcut.shiftKey) {
    parts.push("Shift");
  }

  if (shortcut.altKey) {
    parts.push("Alt");
  }

  if (shortcut.key) {
    parts.push(shortcut.key.toUpperCase());
  }

  return parts.join(" + ");
}

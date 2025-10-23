import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  MagnifyingGlassIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import SearchSuggestions from "./SearchSuggestions";

interface QuickSearchProps {
  placeholder?: string;
  className?: string;
}

export default function QuickSearch({
  placeholder = "搜索任务、笔记、项目、日记... (输入 # 选择标签)",
  className = "",
}: QuickSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 监听全局搜索快捷键事件
  useEffect(() => {
    const handleGlobalShortcut = () => {
      inputRef.current?.focus();
      setShowSuggestions(true);
    };

    window.addEventListener("global-shortcut-search", handleGlobalShortcut);

    return () => {
      window.removeEventListener(
        "global-shortcut-search",
        handleGlobalShortcut,
      );
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0 || isFocused);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // 延迟关闭，允许点击建议项
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    // 如果是对象类型的建议（新格式）
    if (typeof suggestion === "object" && suggestion.type) {
      switch (suggestion.type) {
        case "journal":
          // 日记建议：直接跳转到日记详情页面
          if (suggestion.id) {
            void router.push(`/journal/${suggestion.id}`);
          }
          break;
        case "task":
          // 任务建议：跳转到任务列表页面并尝试打开编辑模态框
          if (suggestion.id) {
            void router.push(`/tasks?edit=${suggestion.id}`);
          }
          break;
        case "note":
          // 笔记建议：跳转到笔记详情页面
          if (suggestion.id) {
            void router.push(`/notes/${suggestion.id}`);
          }
          break;
        case "project":
          // 项目建议：跳转到项目详情页面
          if (suggestion.id) {
            void router.push(`/projects/${suggestion.id}`);
          }
          break;
        case "tag":
          // 标签建议：跳转到标签搜索
          const tagName = suggestion.text.startsWith("#")
            ? suggestion.text.substring(1)
            : suggestion.text;
          void router.push(
            `/search?q=${encodeURIComponent(tagName)}&searchBy=tag`,
          );
          break;
        case "saved-search":
          // 保存的搜索：构建URL参数
          if (suggestion.searchParams) {
            const params = new URLSearchParams();
            const searchParams = suggestion.searchParams;

            // 添加所有搜索参数
            if (searchParams.query) params.set("q", searchParams.query);
            if (searchParams.searchIn)
              params.set("searchIn", searchParams.searchIn.join(","));
            if (searchParams.taskStatus && searchParams.taskStatus.length > 0) {
              params.set("status", searchParams.taskStatus.join(","));
            }
            if (searchParams.priority && searchParams.priority.length > 0) {
              params.set("priority", searchParams.priority.join(","));
            }
            if (searchParams.tagIds && searchParams.tagIds.length > 0) {
              params.set("tagIds", searchParams.tagIds.join(","));
            }
            if (searchParams.projectIds && searchParams.projectIds.length > 0) {
              params.set("projectIds", searchParams.projectIds.join(","));
            }
            if (searchParams.createdAfter) {
              const date =
                typeof searchParams.createdAfter === "string"
                  ? searchParams.createdAfter
                  : searchParams.createdAfter.toISOString().split("T")[0];
              params.set("createdAfter", date);
            }
            if (searchParams.createdBefore) {
              const date =
                typeof searchParams.createdBefore === "string"
                  ? searchParams.createdBefore
                  : searchParams.createdBefore.toISOString().split("T")[0];
              params.set("createdBefore", date);
            }
            if (searchParams.dueAfter) {
              const date =
                typeof searchParams.dueAfter === "string"
                  ? searchParams.dueAfter
                  : searchParams.dueAfter.toISOString().split("T")[0];
              params.set("dueAfter", date);
            }
            if (searchParams.dueBefore) {
              const date =
                typeof searchParams.dueBefore === "string"
                  ? searchParams.dueBefore
                  : searchParams.dueBefore.toISOString().split("T")[0];
              params.set("dueBefore", date);
            }
            if (searchParams.sortBy) params.set("sortBy", searchParams.sortBy);
            if (searchParams.sortOrder)
              params.set("sortOrder", searchParams.sortOrder);
            if (
              searchParams.isCompleted !== null &&
              searchParams.isCompleted !== undefined
            ) {
              params.set("isCompleted", searchParams.isCompleted.toString());
            }
            if (
              searchParams.isOverdue !== null &&
              searchParams.isOverdue !== undefined
            ) {
              params.set("isOverdue", searchParams.isOverdue.toString());
            }
            if (
              searchParams.hasDescription !== null &&
              searchParams.hasDescription !== undefined
            ) {
              params.set(
                "hasDescription",
                searchParams.hasDescription.toString(),
              );
            }

            const queryString = params.toString();
            void router.push(`/search${queryString ? "?" + queryString : ""}`);
          }
          break;
        case "smart":
          // 智能搜索建议：使用预定义的筛选器（保留作为后备）
          const today = new Date().toISOString().split("T")[0];
          const weekStart = getWeekStart().toISOString().split("T")[0];

          const smartFilters = {
            今天的任务: `?searchIn=tasks&createdAfter=${today}`,
            本周笔记: `?searchIn=notes&createdAfter=${weekStart}`,
            高优先级任务: "?searchIn=tasks&priority=HIGH,URGENT",
            进行中的项目: "?searchIn=projects",
            最近的日记: "?searchIn=journals&sortBy=createdAt&sortOrder=desc",
            待办事项: "?searchIn=tasks&status=TODO",
          };

          const filter =
            smartFilters[suggestion.text as keyof typeof smartFilters];
          if (filter) {
            void router.push(`/search${filter}`);
          }
          break;
        default:
          // 默认：普通搜索
          setQuery(suggestion.text);
          handleSearch(suggestion.text);
      }
    } else {
      // 兼容旧格式（字符串类型的建议）
      const suggestionText =
        typeof suggestion === "string" ? suggestion : suggestion.text;

      // 检查是否是智能搜索建议
      const today = new Date().toISOString().split("T")[0];
      const weekStart = getWeekStart().toISOString().split("T")[0];

      const smartFilters = {
        今天的任务: `?searchIn=tasks&createdAfter=${today}`,
        本周笔记: `?searchIn=notes&createdAfter=${weekStart}`,
        高优先级任务: "?searchIn=tasks&priority=HIGH,URGENT",
        进行中的项目: "?searchIn=projects",
        最近的日记: "?searchIn=journals&sortBy=createdAt&sortOrder=desc",
        待办事项: "?searchIn=tasks&status=TODO",
      };

      if (smartFilters[suggestionText as keyof typeof smartFilters]) {
        // 智能搜索：跳转到带参数的搜索页面
        void router.push(
          `/search${smartFilters[suggestionText as keyof typeof smartFilters]}`,
        );
      } else if (suggestionText.startsWith("#")) {
        // 标签搜索：跳转到搜索页面并设置标签查询
        const tagName = suggestionText.substring(1); // 移除 # 前缀
        void router.push(
          `/search?q=${encodeURIComponent(tagName)}&searchBy=tag`,
        );
      } else {
        // 普通搜索：设置查询词并搜索
        setQuery(suggestionText);
        handleSearch(suggestionText);
      }
    }
    setShowSuggestions(false);
  };

  // 获取本周开始日期
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 周一开始
    return new Date(now.setDate(diff));
  };

  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (finalQuery.trim()) {
      // 检查是否是标签搜索
      if (finalQuery.startsWith("#")) {
        const tagName = finalQuery.substring(1).trim();
        void router.push(
          `/search?q=${encodeURIComponent(tagName)}&searchBy=tag`,
        );
      } else {
        // 普通搜索
        void router.push(`/search?q=${encodeURIComponent(finalQuery.trim())}`);
      }
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !showSuggestions) {
      handleSearch();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 transition-colors duration-200" />
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-12 text-sm placeholder-gray-500 shadow-sm transition-all duration-200 hover:border-gray-400 focus:border-blue-500 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        {/* 快捷键提示 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
            <CommandLineIcon className="h-3 w-3" />
            <span className="hidden font-medium sm:inline">K</span>
          </div>
        </div>
      </div>

      {/* 搜索建议 */}
      <SearchSuggestions
        query={query}
        onSelect={handleSuggestionSelect}
        onClose={() => setShowSuggestions(false)}
        isVisible={showSuggestions}
      />
    </div>
  );
}

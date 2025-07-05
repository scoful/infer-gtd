import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { MagnifyingGlassIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import SearchSuggestions from "./SearchSuggestions";

interface QuickSearchProps {
  placeholder?: string;
  className?: string;
}

export default function QuickSearch({
  placeholder = "搜索任务、笔记、项目... (输入 # 选择标签)",
  className = ""
}: QuickSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 全局快捷键支持 (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowSuggestions(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

  const handleSuggestionSelect = (suggestion: string) => {
    // 检查是否是智能搜索建议
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart().toISOString().split('T')[0];

    const smartFilters = {
      "今天的任务": `?searchIn=tasks&createdAfter=${today}`,
      "本周笔记": `?searchIn=notes&createdAfter=${weekStart}`,
      "高优先级任务": "?searchIn=tasks&priority=HIGH,URGENT",
      "进行中的项目": "?searchIn=projects",
      "最近的日记": "?searchIn=journals&sortBy=createdAt&sortOrder=desc",
      "待办事项": "?searchIn=tasks&status=TODO",
    };

    if (smartFilters[suggestion as keyof typeof smartFilters]) {
      // 智能搜索：跳转到带参数的搜索页面
      void router.push(`/search${smartFilters[suggestion as keyof typeof smartFilters]}`);
    } else if (suggestion.startsWith('#')) {
      // 标签搜索：跳转到搜索页面并设置标签查询
      const tagName = suggestion.substring(1); // 移除 # 前缀
      void router.push(`/search?q=${encodeURIComponent(tagName)}&searchBy=tag`);
    } else {
      // 普通搜索：设置查询词并搜索
      setQuery(suggestion);
      handleSearch(suggestion);
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
      if (finalQuery.startsWith('#')) {
        const tagName = finalQuery.substring(1).trim();
        void router.push(`/search?q=${encodeURIComponent(tagName)}&searchBy=tag`);
      } else {
        // 普通搜索
        void router.push(`/search?q=${encodeURIComponent(finalQuery.trim())}`);
      }
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showSuggestions) {
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
          className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-12 text-sm placeholder-gray-500 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-md focus:outline-none hover:border-gray-400"
        />
        
        {/* 快捷键提示 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
            <CommandLineIcon className="h-3 w-3" />
            <span className="hidden sm:inline font-medium">K</span>
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

import { useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  CheckIcon,
  DocumentTextIcon,
  FolderIcon,
  TagIcon,
  ClockIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/utils/api";

interface SearchSuggestion {
  type: string;
  text: string;
  icon: any;
  id?: string;
  color?: string;
  filter?: string;
}

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function SearchSuggestions({
  query,
  onSelect,
  onClose,
  isVisible,
}: SearchSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 获取搜索建议
  const { data: suggestions, isLoading } = api.search.suggestions.useQuery(
    { query: query.startsWith('#') ? query.substring(1) : query, limit: 8 },
    {
      enabled: !!query && query.length >= 2 && !query.startsWith('#') && isVisible,
      staleTime: 60 * 1000, // 增加缓存时间
    }
  );

  // 获取所有标签（当输入 # 时）
  const { data: allTagsData, isLoading: isLoadingTags } = api.tag.getAll.useQuery(
    {
      limit: 20,
      includeCount: false, // 不包含统计信息，提高性能
    },
    {
      enabled: query === '#' && isVisible,
      staleTime: 10 * 60 * 1000, // 10分钟内存缓存
    }
  );

  // 获取保存的搜索作为智能搜索建议
  const { data: savedSearches } = api.search.getSavedSearches.useQuery(undefined, {
    enabled: query.length < 2 && !query.startsWith('#') && isVisible,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 处理标签建议
  const getTagSuggestions = () => {
    if (query === '#') {
      // 显示所有标签
      return allTagsData?.tags?.map((tag: any) => ({
        type: 'tag',
        text: `#${tag.name}`,
        icon: TagIcon,
        id: tag.id,
        color: tag.color
      })) || [];
    } else if (query.startsWith('#')) {
      // 显示匹配的标签
      return suggestions?.tags?.map((tag: any) => ({
        type: 'tag',
        text: `#${tag.name}`,
        icon: TagIcon,
        id: tag.id,
        color: tag.color
      })) || [];
    } else {
      // 普通搜索时的标签建议
      return suggestions?.tags?.map((tag: any) => ({
        type: 'tag',
        text: `#${tag.name}`,
        icon: TagIcon,
        id: tag.id,
        color: tag.color
      })) || [];
    }
  };

  const allSuggestions = [
    // 标签搜索优先（当输入 # 时）
    ...(query.startsWith('#') ? getTagSuggestions() : []),

    // 保存的搜索作为智能搜索建议（仅在没有查询时显示）
    ...(query.length < 2 && !query.startsWith('#') && savedSearches ? savedSearches.map(savedSearch => ({
      type: 'saved-search',
      text: savedSearch.name,
      icon: BookmarkIcon,
      searchParams: savedSearch.searchParams,
      id: savedSearch.id
    })) : []),

    // 普通搜索建议（非标签搜索时）
    ...(!query.startsWith('#') ? [
      ...(suggestions?.tasks?.map((task: any) => ({
        type: 'task',
        text: task.title,
        icon: CheckIcon,
        id: task.id
      })) || []),
      ...(suggestions?.notes?.map((note: any) => ({
        type: 'note',
        text: note.title,
        icon: DocumentTextIcon,
        id: note.id
      })) || []),
      ...(suggestions?.journals?.map((journal: any) => ({
        type: 'journal',
        text: (() => {
          const d = new Date(journal.date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        })(),
        icon: BookmarkIcon,
        id: journal.id
      })) || []),
      ...(getTagSuggestions()),
      ...(suggestions?.projects?.map((project: any) => ({
        type: 'project',
        text: project.name,
        icon: FolderIcon,
        id: project.id
      })) || []),
    ] : []),
  ];

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || allSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < allSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : allSuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (allSuggestions[selectedIndex]) {
            onSelect(allSuggestions[selectedIndex].text);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, allSuggestions, selectedIndex, onSelect, onClose]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, suggestions]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, onClose]);

  if (!isVisible || (query.length >= 2 && !query.startsWith('#') && !suggestions && !isLoading)) {
    return null;
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task':
        return '任务';
      case 'note':
        return '笔记';
      case 'journal':
        return '日记';
      case 'tag':
        return '按标签筛选';
      case 'project':
        return '项目';
      case 'smart':
        return '快速搜索';
      case 'saved-search':
        return '快速搜索';
      default:
        return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'text-blue-600';
      case 'note':
        return 'text-green-600';
      case 'journal':
        return 'text-orange-600';
      case 'tag':
        return 'text-yellow-600';
      case 'project':
        return 'text-purple-600';
      case 'smart':
        return 'text-indigo-600';
      case 'saved-search':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div
      ref={suggestionsRef}
      className="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
    >
      {(isLoading || isLoadingTags) ? (
        <div className="p-4 text-center text-sm text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-5 w-5 animate-spin" />
          <span className="mt-1 block">搜索中...</span>
        </div>
      ) : allSuggestions.length > 0 ? (
        <div className="py-1">
          {allSuggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={`${suggestion.type}-${suggestion.text}-${index}`}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                }`}
                onClick={() => onSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${getTypeColor(suggestion.type)}`} />
                  {suggestion.type === 'tag' && suggestion.color && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: suggestion.color }}
                    />
                  )}
                </div>
                <span className="flex-1 truncate">{suggestion.text}</span>
                {suggestion.type === 'saved-search' ? (
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                    <BookmarkIcon className="mr-1 h-3 w-3" />
                    快速搜索
                  </span>
                ) : (
                  <span className={`text-xs ${getTypeColor(suggestion.type)}`}>
                    {getTypeLabel(suggestion.type)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : query.length >= 2 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-5 w-5" />
          <span className="mt-1 block">没有找到相关建议</span>
        </div>
      ) : query.length === 0 && savedSearches && savedSearches.length > 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          <span>选择下方的快速搜索，或开始输入进行搜索</span>
        </div>
      ) : query.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          <span>开始输入进行搜索</span>
        </div>
      ) : (
        <div className="p-4 text-center text-sm text-gray-500">
          <span>输入至少 2 个字符开始搜索</span>
        </div>
      )}
      
      {/* 搜索提示 */}
      <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>↑↓ 选择 • Enter 确认 • Esc 关闭</span>
          <span>
            {query === '#' ? "选择标签进行筛选" :
             query.startsWith('#') ? "标签筛选模式" :
             query.length < 2 ? "快速搜索功能" :
             "支持搜索任务、笔记、项目、日记"}
          </span>
        </div>
      </div>
    </div>
  );
}

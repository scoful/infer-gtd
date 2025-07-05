import React, { useState } from "react";
import {
  TrashIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "@heroicons/react/24/outline";

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  searchParams: any;
  createdAt: string;
  updatedAt: string;
}

interface SavedSearchCardProps {
  search: SavedSearch;
  onLoad: (search: SavedSearch) => void;
  onEdit: (search: SavedSearch) => void;
  onDelete: (searchId: string, searchName: string) => void;
  generateSearchSummary: (searchParams: any, tags?: any[], projects?: any[]) => string;
  tags?: any[];
  projects?: any[];
}

export default function SavedSearchCard({
  search,
  onLoad,
  onEdit,
  onDelete,
  generateSearchSummary,
  tags = [],
  projects = [],
}: SavedSearchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors">
      {/* 操作按钮 */}
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(search);
          }}
          className="rounded-md p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
          title="编辑"
        >
          <PencilIcon className="h-4 w-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(search.id, search.name);
          }}
          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="删除"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* 主要内容 */}
      <div
        className="cursor-pointer pr-16"
        onClick={() => onLoad(search)}
      >
        <h4 className="text-base font-medium text-gray-900 truncate">
          {search.name}
        </h4>

        {/* 描述 */}
        {search.description && (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {search.description}
          </p>
        )}

        {/* 搜索条件摘要 */}
        <div className="mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <span>搜索条件</span>
            {isExpanded ? (
              <ChevronUpIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )}
          </button>

          <div className={`mt-1 text-xs text-gray-500 leading-relaxed ${
            isExpanded ? "" : "line-clamp-2"
          }`}>
            {generateSearchSummary(search.searchParams, tags, projects)}
          </div>
        </div>

        {/* 创建时间 */}
        <p className="mt-2 text-xs text-gray-400">
          更新于 {formatDate(search.updatedAt)}
        </p>
      </div>
    </div>
  );
}

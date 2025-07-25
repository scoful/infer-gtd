import React from "react";
import {
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  TagIcon,
  FolderIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowsUpDownIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

interface SavedSearch {
  id: string;
  name: string;
  description?: string | null;
  searchParams: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface SearchCondition {
  type:
    | "keyword"
    | "scope"
    | "status"
    | "type"
    | "priority"
    | "tag"
    | "project"
    | "time"
    | "tracking"
    | "sort";
  label: string;
  value: string;
  color: string;
}

interface SavedSearchCardProps {
  search: SavedSearch;
  onLoad: (search: SavedSearch) => void;
  onEdit: (search: SavedSearch) => void;
  onEditConditions: (search: SavedSearch) => void;
  onDelete: (searchId: string, searchName: string) => void;
  generateSearchSummary: (
    searchParams: any,
    tags?: any[],
    projects?: any[],
  ) => string;
  generateSearchConditions: (
    searchParams: any,
    tags?: any[],
    projects?: any[],
  ) => SearchCondition[];
  tags?: any[];
  projects?: any[];
}

export default function SavedSearchCard({
  search,
  onLoad,
  onEdit,
  onEditConditions,
  onDelete,
  generateSearchSummary,
  generateSearchConditions,
  tags = [],
  projects = [],
}: SavedSearchCardProps) {
  // 获取条件类型对应的图标
  const getConditionIcon = (type: SearchCondition["type"]) => {
    const iconProps = { className: "h-3 w-3 flex-shrink-0" };

    switch (type) {
      case "keyword":
        return <MagnifyingGlassIcon {...iconProps} />;
      case "scope":
        return <FunnelIcon {...iconProps} />;
      case "status":
        return <CheckCircleIcon {...iconProps} />;
      case "type":
        return <DocumentTextIcon {...iconProps} />;
      case "priority":
        return <ChartBarIcon {...iconProps} />;
      case "tag":
        return <TagIcon {...iconProps} />;
      case "project":
        return <FolderIcon {...iconProps} />;
      case "time":
        return <ClockIcon {...iconProps} />;
      case "tracking":
        return <ChartBarIcon {...iconProps} />;
      case "sort":
        return <ArrowsUpDownIcon {...iconProps} />;
      default:
        return <FunnelIcon {...iconProps} />;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      onClick={() => onLoad(search)}
      className="group relative cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
    >
      {/* 操作按钮 */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditConditions(search);
          }}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
          title="编辑搜索条件"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(search);
          }}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
          title="编辑名称和描述"
        >
          <PencilIcon className="h-4 w-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(search.id, search.name);
          }}
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="删除"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* 主要内容 */}
      <div className="cursor-pointer pr-24" onClick={() => onLoad(search)}>
        <h4 className="truncate text-base font-medium text-gray-900">
          {search.name}
        </h4>

        {/* 描述 */}
        {search.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {search.description}
          </p>
        )}

        {/* 搜索条件摘要 */}
        <div className="mt-4">
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-600">搜索条件</span>
          </div>

          <div>
            {(() => {
              const conditions = generateSearchConditions(
                search.searchParams,
                tags,
                projects,
              );

              if (conditions.length === 0) {
                return (
                  <span className="text-xs text-gray-500">无特定条件</span>
                );
              }

              return (
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((condition, index) => {
                    // 检查是否是时间筛选条件（包含换行）
                    if (
                      condition.type === "time" &&
                      condition.value.includes("\n")
                    ) {
                      const lines = condition.value.split("\n");
                      return (
                        <div
                          key={index}
                          className={`inline-block rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${condition.color} hover:opacity-80`}
                          title={condition.value.replace(/\n/g, " ")}
                        >
                          <div className="mb-1 flex items-center gap-1">
                            {getConditionIcon(condition.type)}
                            <span className="font-medium">{lines[0]}</span>
                          </div>
                          {lines.slice(1).map((line, lineIndex) => (
                            <div
                              key={lineIndex}
                              className="ml-4 text-xs font-normal"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      );
                    }

                    // 普通条件的显示
                    return (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${condition.color} hover:opacity-80`}
                        title={`${condition.label}: ${condition.value}`}
                      >
                        {getConditionIcon(condition.type)}
                        <span className="font-medium">{condition.label}:</span>
                        <span className="font-normal">{condition.value}</span>
                      </span>
                    );
                  })}
                </div>
              );
            })()}
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

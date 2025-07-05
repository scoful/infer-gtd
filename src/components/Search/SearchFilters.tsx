import { useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  CalendarIcon,
  TagIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { Priority, TaskStatus, TaskType } from "@prisma/client";

interface SearchFiltersProps {
  // 搜索范围
  searchIn: string[];
  onSearchInChange: (searchIn: string[]) => void;
  
  // 任务筛选
  taskStatus: TaskStatus[];
  onTaskStatusChange: (status: TaskStatus[]) => void;
  taskType: TaskType[];
  onTaskTypeChange: (type: TaskType[]) => void;
  priority: Priority[];
  onPriorityChange: (priority: Priority[]) => void;
  
  // 标签和项目
  tagIds: string[];
  onTagIdsChange: (tagIds: string[]) => void;
  projectIds: string[];
  onProjectIdsChange: (projectIds: string[]) => void;
  
  // 日期筛选
  createdAfter: Date | null;
  onCreatedAfterChange: (date: Date | null) => void;
  createdBefore: Date | null;
  onCreatedBeforeChange: (date: Date | null) => void;
  dueAfter: Date | null;
  onDueAfterChange: (date: Date | null) => void;
  dueBefore: Date | null;
  onDueBeforeChange: (date: Date | null) => void;
  
  // 状态筛选
  isCompleted: boolean | null;
  onIsCompletedChange: (completed: boolean | null) => void;
  isOverdue: boolean | null;
  onIsOverdueChange: (overdue: boolean | null) => void;
  hasDescription: boolean | null;
  onHasDescriptionChange: (hasDesc: boolean | null) => void;
  
  // 排序
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
  
  // 数据
  tags?: any[];
  projects?: any[];
  
  // 操作
  onClearFilters: () => void;
}

export default function SearchFilters({
  searchIn,
  onSearchInChange,
  taskStatus,
  onTaskStatusChange,
  taskType,
  onTaskTypeChange,
  priority,
  onPriorityChange,
  tagIds,
  onTagIdsChange,
  projectIds,
  onProjectIdsChange,
  createdAfter,
  onCreatedAfterChange,
  createdBefore,
  onCreatedBeforeChange,
  dueAfter,
  onDueAfterChange,
  dueBefore,
  onDueBeforeChange,
  isCompleted,
  onIsCompletedChange,
  isOverdue,
  onIsOverdueChange,
  hasDescription,
  onHasDescriptionChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  tags = [],
  projects = [],
  onClearFilters,
}: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  const parseDate = (dateString: string) => {
    return dateString ? new Date(dateString) : null;
  };

  const toggleSearchIn = (type: string) => {
    if (searchIn.includes(type)) {
      onSearchInChange(searchIn.filter(t => t !== type));
    } else {
      onSearchInChange([...searchIn, type]);
    }
  };

  const toggleTaskStatus = (status: TaskStatus) => {
    if (taskStatus.includes(status)) {
      onTaskStatusChange(taskStatus.filter(s => s !== status));
    } else {
      onTaskStatusChange([...taskStatus, status]);
    }
  };

  const togglePriority = (p: Priority) => {
    if (priority.includes(p)) {
      onPriorityChange(priority.filter(pr => pr !== p));
    } else {
      onPriorityChange([...priority, p]);
    }
  };

  const toggleTag = (tagId: string) => {
    if (tagIds.includes(tagId)) {
      onTagIdsChange(tagIds.filter(id => id !== tagId));
    } else {
      onTagIdsChange([...tagIds, tagId]);
    }
  };

  const toggleProject = (projectId: string) => {
    if (projectIds.includes(projectId)) {
      onProjectIdsChange(projectIds.filter(id => id !== projectId));
    } else {
      onProjectIdsChange([...projectIds, projectId]);
    }
  };

  const hasActiveFilters = 
    taskStatus.length > 0 ||
    taskType.length > 0 ||
    priority.length > 0 ||
    tagIds.length > 0 ||
    projectIds.length > 0 ||
    createdAfter ||
    createdBefore ||
    dueAfter ||
    dueBefore ||
    isCompleted !== null ||
    isOverdue !== null ||
    hasDescription !== null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">搜索筛选</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-4 w-4" />
              清空筛选
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            {isExpanded ? "收起" : "展开"}筛选
          </button>
        </div>
      </div>

      {/* 搜索范围 */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          搜索范围
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "tasks", label: "任务" },
            { key: "notes", label: "笔记" },
            { key: "projects", label: "项目" },
            { key: "journals", label: "日记" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSearchIn(key)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                searchIn.includes(key)
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* 任务状态筛选 */}
          {searchIn.includes("tasks") && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                任务状态
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(TaskStatus).map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleTaskStatus(status)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      taskStatus.includes(status)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 优先级筛选 */}
          {searchIn.includes("tasks") && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                优先级
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.values(Priority).map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      priority.includes(p)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 排序选项 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                排序方式
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="relevance">相关性</option>
                <option value="createdAt">创建时间</option>
                <option value="updatedAt">更新时间</option>
                <option value="dueDate">截止日期</option>
                <option value="priority">优先级</option>
                <option value="title">标题</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                排序顺序
              </label>
              <select
                value={sortOrder}
                onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

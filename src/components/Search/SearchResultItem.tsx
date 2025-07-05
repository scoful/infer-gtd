import Link from "next/link";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  FolderIcon,
  BookmarkIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { Priority, TaskStatus } from "@prisma/client";

interface SearchResultItemProps {
  type: "task" | "note" | "project" | "journal";
  item: any;
  query?: string;
}

export default function SearchResultItem({ type, item, query }: SearchResultItemProps) {
  const highlightText = (text: string, query?: string) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return "bg-gray-100 text-gray-800";
      case TaskStatus.IN_PROGRESS:
        return "bg-blue-100 text-blue-800";
      case TaskStatus.WAITING:
        return "bg-yellow-100 text-yellow-800";
      case TaskStatus.DONE:
        return "bg-green-100 text-green-800";
      case TaskStatus.CANCELLED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return "待办";
      case TaskStatus.IN_PROGRESS:
        return "进行中";
      case TaskStatus.WAITING:
        return "等待中";
      case TaskStatus.DONE:
        return "已完成";
      case TaskStatus.CANCELLED:
        return "已取消";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return "bg-gray-100 text-gray-800";
      case Priority.MEDIUM:
        return "bg-blue-100 text-blue-800";
      case Priority.HIGH:
        return "bg-orange-100 text-orange-800";
      case Priority.URGENT:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case Priority.LOW:
        return "低";
      case Priority.MEDIUM:
        return "中";
      case Priority.HIGH:
        return "高";
      case Priority.URGENT:
        return "紧急";
      default:
        return priority;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("zh-CN", {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getItemLink = () => {
    switch (type) {
      case "task":
        return `/tasks?id=${item.id}`;
      case "note":
        return `/notes/${item.id}`;
      case "project":
        return `/projects/${item.id}`;
      case "journal":
        return `/journal/${item.id}`;
      default:
        return "#";
    }
  };

  const getItemIcon = () => {
    switch (type) {
      case "task":
        return <CheckIcon className="h-5 w-5 text-blue-500" />;
      case "note":
        return <DocumentTextIcon className="h-5 w-5 text-green-500" />;
      case "project":
        return <FolderIcon className="h-5 w-5 text-purple-500" />;
      case "journal":
        return <BookmarkIcon className="h-5 w-5 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <Link href={getItemLink()}>
      <div className="group rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getItemIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <h4 className="text-base font-medium text-gray-900 group-hover:text-blue-900 truncate">
              {highlightText(item.title || item.name, query)}
            </h4>
            
            {/* 内容预览 */}
            {(item.description || item.content) && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {highlightText(item.description || item.content, query)}
              </p>
            )}
            
            {/* 元数据 */}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              {/* 任务特有信息 */}
              {type === "task" && (
                <>
                  <span className={`rounded-full px-2 py-1 ${getStatusColor(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                  {item.priority && (
                    <span className={`rounded-full px-2 py-1 ${getPriorityColor(item.priority)}`}>
                      {getPriorityLabel(item.priority)}
                    </span>
                  )}
                  {item.dueDate && (
                    <span className="flex items-center">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {formatDate(item.dueDate)}
                    </span>
                  )}
                  {item.totalTimeSpent > 0 && (
                    <span className="flex items-center">
                      <ClockIcon className="mr-1 h-3 w-3" />
                      {Math.round(item.totalTimeSpent / 60)}分钟
                    </span>
                  )}
                </>
              )}
              
              {/* 项目信息 */}
              {item.project && (
                <span className="flex items-center">
                  <FolderIcon className="mr-1 h-3 w-3" />
                  {item.project.name}
                </span>
              )}
              
              {/* 标签信息 */}
              {item.tags && item.tags.length > 0 && (
                <span className="flex items-center">
                  <TagIcon className="mr-1 h-3 w-3" />
                  {item.tags.slice(0, 2).map((tagRel: any) => tagRel.tag.name).join(", ")}
                  {item.tags.length > 2 && ` +${item.tags.length - 2}`}
                </span>
              )}
              
              {/* 日期信息 */}
              <span>
                {type === "journal" ? formatDate(item.date) : formatDate(item.updatedAt)}
              </span>
              
              {/* 项目统计 */}
              {type === "project" && item._count && (
                <span>
                  {item._count.tasks} 个任务, {item._count.notes} 个笔记
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

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
  onTaskClick?: (task: any) => void; // 任务点击回调
}

// 计算搜索相关性得分
const calculateRelevanceScore = (item: any, query: string): number => {
  if (!query?.trim()) return 0;

  const searchTerms = query
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 0);
  let score = 0;

  const title = (item.title || item.name || "").toLowerCase();
  const content = (item.description || item.content || "").toLowerCase();

  searchTerms.forEach((term) => {
    // 标题匹配权重更高
    if (title.includes(term)) {
      score += title.indexOf(term) === 0 ? 10 : 5; // 开头匹配得分更高
    }
    // 内容匹配
    if (content.includes(term)) {
      score += 2;
    }
    // 标签匹配
    if (
      item.tags?.some((tagRel: any) =>
        tagRel.tag.name.toLowerCase().includes(term),
      )
    ) {
      score += 3;
    }
  });

  return Math.min(score, 10); // 最高10分
};

export default function SearchResultItem({
  type,
  item,
  query,
  onTaskClick,
}: SearchResultItemProps) {
  const relevanceScore = calculateRelevanceScore(item, query || "");

  // 获取相关性指示器
  const getRelevanceIndicator = () => {
    if (!query || relevanceScore === 0) return null;

    const level =
      relevanceScore >= 8 ? "high" : relevanceScore >= 5 ? "medium" : "low";
    const colors = {
      high: "bg-green-500",
      medium: "bg-yellow-500",
      low: "bg-gray-400",
    };

    return (
      <div
        className="flex items-center gap-1"
        title={`相关性: ${relevanceScore}/10`}
      >
        <div className="flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 w-1 rounded-full ${
                i <= relevanceScore / 3.33 ? colors[level] : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const highlightText = (text: string, query?: string) => {
    if (!query || !text) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="rounded bg-yellow-200 px-1 text-yellow-900"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDEA:
        return "bg-gray-100 text-gray-800";
      case TaskStatus.TODO:
        return "bg-blue-100 text-blue-800";
      case TaskStatus.IN_PROGRESS:
        return "bg-yellow-100 text-yellow-800";
      case TaskStatus.WAITING:
        return "bg-purple-100 text-purple-800";
      case TaskStatus.DONE:
        return "bg-green-100 text-green-800";
      case TaskStatus.ARCHIVED:
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDEA:
        return "想法";
      case TaskStatus.TODO:
        return "待办";
      case TaskStatus.IN_PROGRESS:
        return "进行中";
      case TaskStatus.WAITING:
        return "等待中";
      case TaskStatus.DONE:
        return "已完成";
      case TaskStatus.ARCHIVED:
        return "已归档";
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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 根据标签颜色生成样式（与TagList组件的default变体保持一致）
  const getTagStyle = (tag: any) => {
    const baseColor = tag.color ?? "#6B7280"; // 默认灰色
    return {
      backgroundColor: baseColor, // 使用标签的原始颜色作为背景
      color: "white", // 白色文字
    };
  };

  // 根据项目颜色生成样式（与任务看板保持一致）
  const getProjectStyle = (project: any) => {
    return {
      backgroundColor: project.color ? `${project.color}20` : "#f3f4f6", // 20%透明度背景或默认灰色
      color: project.color ?? "#374151", // 原始颜色或默认深灰色
    };
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

  const getTypeColor = () => {
    switch (type) {
      case "task":
        return "bg-blue-500";
      case "note":
        return "bg-green-500";
      case "project":
        return "bg-purple-500";
      case "journal":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleClick = () => {
    if (type === "task" && onTaskClick) {
      onTaskClick(item);
    }
  };

  const content = (
    <div className="group relative cursor-pointer rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* 图标和类型指示器 */}
        <div className="mt-1 flex-shrink-0">
          <div className="relative">
            {getItemIcon()}
            {/* 类型标识 */}
            <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border border-gray-200 bg-white">
              <div
                className={`h-1.5 w-1.5 rounded-full ${getTypeColor()}`}
              ></div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h4 className="line-clamp-1 text-base font-semibold text-gray-900 group-hover:text-blue-900">
                {highlightText(item.title || item.name, query)}
              </h4>
              {/* 相关性指示器 */}
              {getRelevanceIndicator()}
            </div>

            {/* 右侧快速信息 */}
            <div className="flex flex-shrink-0 items-center gap-2">
              {/* 相关性指示器 */}
              {getRelevanceIndicator()}
            </div>
          </div>

          {/* 内容预览 */}
          {(item.description || item.content) && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">
              {highlightText(item.description || item.content, query)}
            </p>
          )}

          {/* 元数据行 */}
          <div className="mt-3 flex items-center justify-between">
            {/* 左侧：主要信息 */}
            <div className="flex items-center gap-2 text-xs">
              {/* 任务状态、优先级和标签（统一放在左侧） */}
              {type === "task" && (
                <>
                  {/* 任务状态 */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}
                  >
                    {getStatusLabel(item.status)}
                  </span>

                  {/* 优先级 */}
                  {item.priority && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getPriorityColor(item.priority)}`}
                    >
                      {getPriorityLabel(item.priority)}
                    </span>
                  )}

                  {/* 标签信息 */}
                  {item.tags && item.tags.length > 0 && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                      style={getTagStyle(item.tags[0].tag)}
                    >
                      {item.tags[0].tag.icon && (
                        <span className="text-xs">{item.tags[0].tag.icon}</span>
                      )}
                      {
                        item.tags
                          .slice(0, 1)
                          .map((tagRel: any) => tagRel.tag.name)[0]
                      }
                      {item.tags.length > 1 && ` +${item.tags.length - 1}`}
                    </span>
                  )}
                </>
              )}

              {/* 项目信息 */}
              {item.project && (
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                  style={getProjectStyle(item.project)}
                >
                  <FolderIcon className="h-3 w-3" />
                  {item.project.name}
                </span>
              )}

              {/* 非任务类型的标签信息 */}
              {type !== "task" && item.tags && item.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <TagIcon className="h-3 w-3" />
                  <span
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                    style={getTagStyle(item.tags[0].tag)}
                  >
                    {item.tags[0].tag.icon && (
                      <span className="text-xs">{item.tags[0].tag.icon}</span>
                    )}
                    {
                      item.tags
                        .slice(0, 1)
                        .map((tagRel: any) => tagRel.tag.name)[0]
                    }
                    {item.tags.length > 1 && ` +${item.tags.length - 1}`}
                  </span>
                </div>
              )}

              {/* 任务特有信息 */}
              {type === "task" && (
                <>
                  {item.dueDate && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(item.dueDate)}
                    </span>
                  )}
                  {item.totalTimeSpent > 0 && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <ClockIcon className="h-3 w-3" />
                      {Math.round(item.totalTimeSpent / 60)}分钟
                    </span>
                  )}
                </>
              )}

              {/* 项目统计 */}
              {type === "project" && item._count && (
                <span className="rounded-md bg-gray-100 px-2 py-1">
                  {item._count.tasks} 任务 · {item._count.notes} 笔记
                </span>
              )}
            </div>

            {/* 右侧：时间信息 */}
            <span className="text-xs text-gray-400">
              {type === "journal"
                ? formatDate(item.date)
                : formatDate(item.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // 任务类型使用点击事件，其他类型使用 Link
  if (type === "task") {
    return <div onClick={handleClick}>{content}</div>;
  }

  return <Link href={getItemLink()}>{content}</Link>;
}

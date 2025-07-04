import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus, Priority, TaskType } from "@prisma/client";

import { api } from "@/utils/api";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

// 任务类型定义
type TaskWithRelations = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  type: TaskType;
  priority?: Priority | null;
  dueDate?: Date | null;
  dueTime?: string | null;
  completedAt?: Date | null;
  totalTimeSpent: number;
  isTimerActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  project?: { id: string; name: string; color?: string | null } | null;
  tags: Array<{
    tag: {
      id: string;
      name: string;
      color?: string | null;
      type: any;
      category?: string | null;
      isSystem: boolean;
      description?: string | null;
      icon?: string | null;
    };
  }>;
  timeEntries: Array<{
    id: string;
    startTime: Date;
    endTime?: Date | null;
  }>;
  _count?: {
    timeEntries: number;
    statusHistory: number;
  };
};

interface ProjectTaskListProps {
  projectId: string;
  onCreateTask: () => void;
  onEditTask?: (taskId: string) => void;
}

// 任务状态配置
const TASK_STATUS_CONFIG = {
  [TaskStatus.IDEA]: { label: "想法", color: "bg-gray-100 text-gray-800" },
  [TaskStatus.TODO]: { label: "待办", color: "bg-blue-100 text-blue-800" },
  [TaskStatus.IN_PROGRESS]: {
    label: "进行中",
    color: "bg-yellow-100 text-yellow-800",
  },
  [TaskStatus.WAITING]: {
    label: "等待中",
    color: "bg-purple-100 text-purple-800",
  },
  [TaskStatus.DONE]: { label: "已完成", color: "bg-green-100 text-green-800" },
  [TaskStatus.ARCHIVED]: {
    label: "已归档",
    color: "bg-gray-100 text-gray-800",
  },
};

// 优先级配置
const PRIORITY_CONFIG = {
  [Priority.LOW]: { label: "低", color: "text-gray-500" },
  [Priority.MEDIUM]: { label: "中", color: "text-blue-500" },
  [Priority.HIGH]: { label: "高", color: "text-orange-500" },
  [Priority.URGENT]: { label: "紧急", color: "text-red-500" },
};

// 任务卡片组件
interface TaskCardProps {
  task: TaskWithRelations;
  onEdit: () => void;
  onStatusChange: (status: TaskStatus) => void;
}

function TaskCard({ task, onEdit, onStatusChange }: TaskCardProps) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const priorityConfig = task.priority ? PRIORITY_CONFIG[task.priority] : null;

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // 计算限时任务的剩余时间和紧急程度
  const getDeadlineInfo = (task: any) => {
    if (task.type !== TaskType.DEADLINE || !task.dueDate) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(task.dueDate);

    // 如果有具体时间，设置到deadline
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":");
      deadline.setHours(parseInt(hours ?? "0"), parseInt(minutes ?? "0"), 0, 0);
    } else {
      // 没有具体时间，设置为当天23:59
      deadline.setHours(23, 59, 59, 999);
    }

    const diffMs = deadline.getTime() - now.getTime();
    const isOverdue = diffMs < 0;

    const absDiffMs = Math.abs(diffMs);
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

    // 确定紧急程度
    let urgencyLevel: "overdue" | "critical" | "urgent" | "warning" | "normal";
    if (isOverdue) {
      urgencyLevel = "overdue";
    } else if (days === 0 && hours <= 2) {
      urgencyLevel = "critical"; // 2小时内
    } else if (days === 0) {
      urgencyLevel = "urgent"; // 今天截止
    } else if (days <= 1) {
      urgencyLevel = "warning"; // 明天截止
    } else {
      urgencyLevel = "normal";
    }

    return {
      isOverdue,
      days,
      hours,
      minutes,
      urgencyLevel,
      deadline,
      timeText: isOverdue
        ? `已逾期 ${days > 0 ? `${days}天` : ""}${hours > 0 ? `${hours}小时` : ""}${days === 0 && hours === 0 ? `${minutes}分钟` : ""}`
        : days > 0
          ? `剩余 ${days}天${hours > 0 ? `${hours}小时` : ""}`
          : hours > 0
            ? `剩余 ${hours}小时${minutes > 0 ? `${minutes}分钟` : ""}`
            : `剩余 ${minutes}分钟`,
    };
  };

  const deadlineInfo = getDeadlineInfo(task);

  // 限时任务的样式配置
  const getDeadlineCardStyles = () => {
    if (
      task.type !== TaskType.DEADLINE ||
      !deadlineInfo ||
      task.status === TaskStatus.DONE
    ) {
      return "rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow";
    }

    const urgencyStyles = {
      overdue:
        "rounded-lg border border-gray-200 border-l-4 border-l-red-600 bg-red-50 p-4 shadow-sm hover:shadow-md transition-shadow",
      critical:
        "rounded-lg border border-gray-200 border-l-4 border-l-red-500 bg-red-25 p-4 shadow-sm hover:shadow-md transition-shadow",
      urgent:
        "rounded-lg border border-gray-200 border-l-4 border-l-orange-500 bg-orange-25 p-4 shadow-sm hover:shadow-md transition-shadow",
      warning:
        "rounded-lg border border-gray-200 border-l-4 border-l-yellow-500 bg-yellow-25 p-4 shadow-sm hover:shadow-md transition-shadow",
      normal:
        "rounded-lg border border-gray-200 border-l-4 border-l-blue-500 bg-blue-25 p-4 shadow-sm hover:shadow-md transition-shadow",
    };

    return urgencyStyles[deadlineInfo.urgencyLevel];
  };

  return (
    <div className={`relative ${getDeadlineCardStyles()}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center space-x-2">
            <h4 className="truncate text-sm font-medium text-gray-900">
              {task.title}
            </h4>
            {priorityConfig && (
              <span className={`text-xs font-medium ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
            )}
          </div>

          {task.description && (
            <p className="mb-3 line-clamp-2 text-sm text-gray-600">
              {task.description}
            </p>
          )}

          {/* 限时任务的倒计时显示 - 已完成任务不显示倒计时 */}
          {task.type === TaskType.DEADLINE &&
            deadlineInfo &&
            task.status !== TaskStatus.DONE && (
              <div className="mb-3">
                <div
                  className={`mb-1 text-xs font-medium ${
                    deadlineInfo.urgencyLevel === "overdue"
                      ? "text-red-700"
                      : deadlineInfo.urgencyLevel === "critical"
                        ? "text-red-600"
                        : deadlineInfo.urgencyLevel === "urgent"
                          ? "text-orange-600"
                          : deadlineInfo.urgencyLevel === "warning"
                            ? "text-yellow-600"
                            : "text-blue-600"
                  }`}
                >
                  {deadlineInfo.timeText}
                </div>
                {/* 具体截止时间另起一行显示 - 包含日期 */}
                {task.dueDate && (
                  <div className="text-xs text-gray-500">
                    截止时间：
                    {new Date(task.dueDate).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                    {task.dueTime ? ` ${task.dueTime}` : " 全天"}
                  </div>
                )}
              </div>
            )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>

              {task.totalTimeSpent > 0 && (
                <div className="flex items-center text-xs text-gray-500">
                  <ClockIcon className="mr-1 h-3 w-3" />
                  {formatTimeSpent(task.totalTimeSpent)}
                </div>
              )}

              {/* 非限时任务仍显示简单的截止日期 */}
              {task.dueDate && task.type !== TaskType.DEADLINE && (
                <div className="flex items-center text-xs text-gray-500">
                  <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>

            <button
              onClick={onEdit}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 快速状态切换 */}
      <div className="mt-3 flex items-center space-x-2">
        {task.status !== TaskStatus.DONE && (
          <button
            onClick={() => onStatusChange(TaskStatus.DONE)}
            className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
          >
            <CheckCircleIcon className="mr-1 h-3 w-3" />
            完成
          </button>
        )}

        {task.status === TaskStatus.TODO && (
          <button
            onClick={() => onStatusChange(TaskStatus.IN_PROGRESS)}
            className="inline-flex items-center rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-200"
          >
            <PlayIcon className="mr-1 h-3 w-3" />
            开始
          </button>
        )}

        {task.status === TaskStatus.IN_PROGRESS && (
          <button
            onClick={() => onStatusChange(TaskStatus.TODO)}
            className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
          >
            <PauseIcon className="mr-1 h-3 w-3" />
            暂停
          </button>
        )}
      </div>

      {/* 限时任务的时间进度条 - 已完成任务不显示 */}
      {task.type === TaskType.DEADLINE &&
        deadlineInfo &&
        !deadlineInfo.isOverdue &&
        task.status !== TaskStatus.DONE && (
          <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-lg bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${
                deadlineInfo.urgencyLevel === "critical"
                  ? "bg-red-500"
                  : deadlineInfo.urgencyLevel === "urgent"
                    ? "bg-orange-500"
                    : deadlineInfo.urgencyLevel === "warning"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    ((Date.now() - new Date(task.createdAt).getTime()) /
                      (deadlineInfo.deadline.getTime() -
                        new Date(task.createdAt).getTime())) *
                      100,
                  ),
                )}%`,
              }}
            />
          </div>
        )}
    </div>
  );
}

export default function ProjectTaskList({
  projectId,
  onCreateTask,
  onEditTask,
}: ProjectTaskListProps) {
  const { showSuccess, showError } = useGlobalNotifications();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");

  // 查询参数
  const queryParams = useMemo(
    () => ({
      id: projectId,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      limit: 20,
    }),
    [projectId, statusFilter, priorityFilter],
  );

  // 获取项目任务数据
  const {
    data: tasksData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.project.getTasks.useInfiniteQuery(queryParams, {
    enabled: !!projectId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 任务操作
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
      showSuccess("任务状态更新成功");
    },
    onError: (error) => {
      showError(`更新失败: ${error.message}`);
    },
  });

  // 合并所有页面的任务数据
  const tasks = useMemo(() => {
    return tasksData?.pages.flatMap((page) => page.tasks) ?? [];
  }, [tasksData]);

  // 客户端搜索过滤
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query),
    );
  }, [tasks, searchQuery]);

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status });
    } catch (error) {
      console.error("更新任务状态失败:", error);
    }
  };

  const handleEditTask = (taskId: string) => {
    if (onEditTask) {
      // 使用传入的编辑回调函数（打开模态框）
      onEditTask(taskId);
    } else {
      // 降级到跳转页面
      window.open(`/tasks?id=${taskId}`, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-4">
        <div className="flex flex-1 items-center space-x-4">
          {/* 搜索框 */}
          <div className="relative max-w-md flex-1">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* 筛选器容器 */}
          <div className="flex items-center space-x-3">
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TaskStatus | "")
              }
              className="min-w-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">所有状态</option>
              {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ))}
            </select>

            {/* 优先级筛选 */}
            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as Priority | "")
              }
              className="min-w-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">所有优先级</option>
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                <option key={priority} value={priority}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={onCreateTask}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            新建任务
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <QueryLoading
        isLoading={isLoading}
        error={null}
        loadingMessage="加载项目任务中..."
        loadingComponent={<SectionLoading message="加载项目任务中..." />}
      >
        {filteredTasks.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => handleEditTask(task.id)}
                  onStatusChange={(status) =>
                    handleStatusChange(task.id, status)
                  }
                />
              ))}
            </div>

            {/* 加载更多按钮 */}
            {hasNextPage && (
              <div className="flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                >
                  {isFetchingNextPage ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无任务</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? "没有找到匹配的任务" : "开始为这个项目创建任务"}
            </p>
            {!searchQuery && (
              <div className="mt-6">
                <button
                  onClick={onCreateTask}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  新建任务
                </button>
              </div>
            )}
          </div>
        )}
      </QueryLoading>
    </div>
  );
}

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
import { TaskStatus, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface ProjectTaskListProps {
  projectId: string;
  onCreateTask: () => void;
}

// 任务状态配置
const TASK_STATUS_CONFIG = {
  [TaskStatus.IDEA]: { label: "想法", color: "bg-gray-100 text-gray-800" },
  [TaskStatus.TODO]: { label: "待办", color: "bg-blue-100 text-blue-800" },
  [TaskStatus.IN_PROGRESS]: { label: "进行中", color: "bg-yellow-100 text-yellow-800" },
  [TaskStatus.WAITING]: { label: "等待中", color: "bg-purple-100 text-purple-800" },
  [TaskStatus.DONE]: { label: "已完成", color: "bg-green-100 text-green-800" },
  [TaskStatus.ARCHIVED]: { label: "已归档", color: "bg-gray-100 text-gray-800" },
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
  task: any;
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {task.title}
            </h4>
            {priorityConfig && (
              <span className={`text-xs font-medium ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
            )}
          </div>
          
          {task.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              
              {task.totalTimeSpent > 0 && (
                <div className="flex items-center text-xs text-gray-500">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {formatTimeSpent(task.totalTimeSpent)}
                </div>
              )}

              {task.dueDate && (
                <div className="flex items-center text-xs text-gray-500">
                  <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>

            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
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
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
          >
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            完成
          </button>
        )}
        
        {task.status === TaskStatus.TODO && (
          <button
            onClick={() => onStatusChange(TaskStatus.IN_PROGRESS)}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200"
          >
            <PlayIcon className="h-3 w-3 mr-1" />
            开始
          </button>
        )}

        {task.status === TaskStatus.IN_PROGRESS && (
          <button
            onClick={() => onStatusChange(TaskStatus.TODO)}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
          >
            <PauseIcon className="h-3 w-3 mr-1" />
            暂停
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProjectTaskList({ projectId, onCreateTask }: ProjectTaskListProps) {
  const { showSuccess, showError } = useGlobalNotifications();
  
  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");

  // 查询参数
  const queryParams = useMemo(() => ({
    id: projectId,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 20,
  }), [projectId, statusFilter, priorityFilter]);

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
    return tasksData?.pages.flatMap(page => page.tasks) ?? [];
  }, [tasksData]);

  // 客户端搜索过滤
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    
    const query = searchQuery.toLowerCase();
    return tasks.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
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
    // 跳转到任务详情页面或打开编辑模态框
    window.open(`/tasks?id=${taskId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-4">
        <div className="flex flex-1 items-center space-x-4">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 筛选器容器 */}
          <div className="flex items-center space-x-3">
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
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
              onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
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
                  onStatusChange={(status) => handleStatusChange(task.id, status)}
                />
              ))}
            </div>

            {/* 加载更多按钮 */}
            {hasNextPage && (
              <div className="flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isFetchingNextPage ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
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

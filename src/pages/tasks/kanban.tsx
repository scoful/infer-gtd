import { type NextPage } from "next";
import Head from "next/head";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { TaskStatus, type Task } from "@prisma/client";
import {
  PlusIcon,
  EllipsisVerticalIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
} from "@heroicons/react/24/outline";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import TaskModal from "@/components/Tasks/TaskModal";
import { PageLoading } from "@/components/UI";

// 看板列配置
const KANBAN_COLUMNS = [
  {
    status: TaskStatus.IDEA,
    title: "想法",
    description: "待整理的想法和灵感",
    color: "bg-gray-100 border-gray-300",
    headerColor: "bg-gray-50",
  },
  {
    status: TaskStatus.TODO,
    title: "待办",
    description: "已规划的待执行任务",
    color: "bg-blue-100 border-blue-300",
    headerColor: "bg-blue-50",
  },
  {
    status: TaskStatus.IN_PROGRESS,
    title: "进行中",
    description: "正在执行的任务",
    color: "bg-yellow-100 border-yellow-300",
    headerColor: "bg-yellow-50",
  },
  {
    status: TaskStatus.WAITING,
    title: "等待中",
    description: "等待他人或外部条件",
    color: "bg-purple-100 border-purple-300",
    headerColor: "bg-purple-50",
  },
  {
    status: TaskStatus.DONE,
    title: "已完成",
    description: "已完成的任务",
    color: "bg-green-100 border-green-300",
    headerColor: "bg-green-50",
  },
] as const;

// 扩展Task类型以包含关联数据
type TaskWithRelations = Task & {
  project?: { id: string; name: string; color?: string | null } | null;
  tags: Array<{
    tag: { id: string; name: string; color?: string | null };
  }>;
  timeEntries: Array<{
    id: string;
    startTime: Date;
    endTime?: Date | null;
  }>;
  _count: {
    timeEntries: number;
    statusHistory: number;
  };
};

const KanbanPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 移动距离后才开始拖拽
      },
    })
  );

  // 获取所有任务
  const { data: tasksData, isLoading, refetch } = api.task.getAll.useQuery(
    { limit: 100 }, // 获取更多任务用于看板显示
    {
      enabled: !!sessionData,
      staleTime: 1 * 60 * 1000, // 1分钟缓存
      refetchOnWindowFocus: false,
    }
  );

  // 按状态分组任务
  const tasksByStatus = useMemo(() => {
    if (!tasksData?.tasks) return {};

    const grouped: Record<TaskStatus, TaskWithRelations[]> = {
      [TaskStatus.IDEA]: [],
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.WAITING]: [],
      [TaskStatus.DONE]: [],
      [TaskStatus.ARCHIVED]: [],
    };

    tasksData.tasks.forEach((task) => {
      if (task.status !== TaskStatus.ARCHIVED) {
        grouped[task.status].push(task as TaskWithRelations);
      }
    });

    return grouped;
  }, [tasksData]);

  // 任务状态更新
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // 时间追踪
  const startTimer = api.task.startTimer.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const pauseTimer = api.task.pauseTimer.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: newStatus,
        note: `状态变更为${KANBAN_COLUMNS.find(col => col.status === newStatus)?.title}`,
      });
    } catch (error) {
      console.error("状态更新失败:", error);
    }
  };

  const handleStartTimer = async (taskId: string) => {
    try {
      await startTimer.mutateAsync({
        id: taskId,
        description: "开始工作",
      });
    } catch (error) {
      console.error("开始计时失败:", error);
    }
  };

  const handlePauseTimer = async (taskId: string) => {
    try {
      await pauseTimer.mutateAsync({
        id: taskId,
        description: "暂停工作",
      });
    } catch (error) {
      console.error("暂停计时失败:", error);
    }
  };

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isTimerActive = (task: TaskWithRelations) => {
    return task.isTimerActive && task.timeEntries.some(entry => !entry.endTime);
  };

  const handleCreateTask = () => {
    setEditingTaskId(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setEditingTaskId(null);
  };

  const handleTaskModalSuccess = () => {
    void refetch();
  };

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // 拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // 如果状态没有改变，不执行任何操作
    const currentTask = Object.values(tasksByStatus)
      .flat()
      .find((task: TaskWithRelations) => task.id === taskId);

    if (!currentTask || currentTask.status === newStatus) return;

    // 乐观更新：立即更新UI
    try {
      await handleStatusChange(taskId, newStatus);
    } catch (error) {
      console.error("拖拽更新状态失败:", error);
      // 这里可以添加错误提示
    }
  };

  // 获取当前拖拽的任务
  const activeTask = activeId
    ? Object.values(tasksByStatus).flat().find((task: TaskWithRelations) => task.id === activeId)
    : null;

  if (isLoading) {
    return (
      <AuthGuard>
        <MainLayout>
          <PageLoading message="加载任务中..." />
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>任务看板 | Smart GTD</title>
          <meta name="description" content="可视化任务管理看板" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和操作 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">任务看板</h1>
              <p className="mt-1 text-sm text-gray-500">
                拖拽任务卡片来更新状态，可视化管理您的工作流程
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateTask}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              新建任务
            </button>
          </div>

          {/* 看板列 */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {KANBAN_COLUMNS.map((column) => {
              const tasks = tasksByStatus[column.status] || [];

              return (
                <KanbanColumn
                  key={column.status}
                  column={column}
                  tasks={tasks}
                  onStatusChange={handleStatusChange}
                  onStartTimer={handleStartTimer}
                  onPauseTimer={handlePauseTimer}
                  onEdit={handleEditTask}
                  formatTimeSpent={formatTimeSpent}
                  isTimerActive={isTimerActive}
                  isUpdating={updateTaskStatus.isPending}
                />
              );
            })}
            </div>

            {/* 拖拽覆盖层 */}
            <DragOverlay>
              {activeTask ? (
                <div className="transform rotate-3 opacity-90">
                  <TaskCard
                    task={activeTask}
                    onStatusChange={() => {}}
                    onStartTimer={() => {}}
                    onPauseTimer={() => {}}
                    onEdit={() => {}}
                    formatTimeSpent={formatTimeSpent}
                    isTimerActive={isTimerActive(activeTask)}
                    isUpdating={false}
                    isDragging={true}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* 任务模态框 */}
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleTaskModalClose}
          taskId={editingTaskId || undefined}
          onSuccess={handleTaskModalSuccess}
        />
      </MainLayout>
    </AuthGuard>
  );
};

// 看板列组件
interface KanbanColumnProps {
  column: {
    status: TaskStatus;
    title: string;
    description: string;
    color: string;
    headerColor: string;
  };
  tasks: TaskWithRelations[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  isUpdating: boolean;
}

function KanbanColumn({
  column,
  tasks,
  onStatusChange,
  onStartTimer,
  onPauseTimer,
  onEdit,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
}: KanbanColumnProps) {
  const { setNodeRef } = useSortable({
    id: column.status,
    data: {
      type: "column",
      status: column.status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed ${column.color} min-h-[600px]`}
    >
      {/* 列标题 */}
      <div className={`${column.headerColor} rounded-t-lg px-4 py-3 border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {column.title}
            </h3>
            <p className="text-xs text-gray-500">
              {tasks.length} 个任务
            </p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="p-3 space-y-3">
          {tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              onEdit={onEdit}
              formatTimeSpent={formatTimeSpent}
              isTimerActive={isTimerActive(task)}
              isUpdating={isUpdating}
            />
          ))}

          {tasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">暂无任务</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// 可拖拽的任务卡片组件
interface DraggableTaskCardProps {
  task: TaskWithRelations;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
}

function DraggableTaskCard(props: DraggableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.task.id,
    data: {
      type: "task",
      task: props.task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} isDragging={isDragging} />
    </div>
  );
}

// 任务卡片组件
interface TaskCardProps {
  task: TaskWithRelations;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
  isDragging?: boolean;
}

function TaskCard({
  task,
  onStatusChange,
  onStartTimer,
  onPauseTimer,
  onEdit,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  isDragging = false,
}: TaskCardProps) {
  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  return (
    <div
      className={`bg-white rounded-lg border p-4 shadow-sm transition-all cursor-pointer ${
        isDragging
          ? "border-blue-300 shadow-lg transform rotate-2"
          : "border-gray-200 hover:shadow-md hover:border-gray-300"
      }`}
      onClick={() => !isDragging && onEdit(task.id)}
    >
      {/* 任务标题 */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
          {task.title}
        </h4>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task.id);
          }}
          className="text-gray-400 hover:text-gray-600 ml-2"
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
        </button>
      </div>

      {/* 任务描述 */}
      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* 标签和项目 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {task.project && (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: task.project.color ? `${task.project.color}20` : '#f3f4f6',
              color: task.project.color || '#374151',
            }}
          >
            {task.project.name}
          </span>
        )}

        {task.tags.slice(0, 2).map((tagRelation) => (
          <span
            key={tagRelation.tag.id}
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: tagRelation.tag.color ? `${tagRelation.tag.color}20` : '#f3f4f6',
              color: tagRelation.tag.color || '#374151',
            }}
          >
            {tagRelation.tag.name}
          </span>
        ))}

        {task.tags.length > 2 && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            +{task.tags.length - 2}
          </span>
        )}
      </div>

      {/* 底部信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* 优先级 */}
          {task.priority && (
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
          )}

          {/* 时间信息 */}
          {task.totalTimeSpent > 0 && (
            <span className="text-xs text-gray-500 flex items-center">
              <ClockIcon className="h-3 w-3 mr-1" />
              {formatTimeSpent(task.totalTimeSpent)}
            </span>
          )}
        </div>

        {/* 计时器控制 */}
        <div className="flex items-center space-x-1">
          {task.status === TaskStatus.IN_PROGRESS && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isTimerActive) {
                  onPauseTimer(task.id);
                } else {
                  onStartTimer(task.id);
                }
              }}
              disabled={isUpdating}
              className={`p-1 rounded-full ${
                isTimerActive
                  ? "text-red-600 hover:bg-red-50"
                  : "text-green-600 hover:bg-green-50"
              } disabled:opacity-50`}
            >
              {isTimerActive ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default KanbanPage;

import { type NextPage } from "next";
import Head from "next/head";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { TaskStatus, type Task } from "@prisma/client";
import {
  PlusIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ArrowUpIcon,
} from "@heroicons/react/24/outline";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type CollisionDetection,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import TaskModal from "@/components/Tasks/TaskModal";
import { PageLoading, ConfirmModal } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useConfirm } from "@/hooks";
import { TagList, type TagData } from "@/components/Tags";

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
    tag: { id: string; name: string; color?: string | null; type: any; category?: string | null; isSystem: boolean; description?: string | null; icon?: string | null };
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

  // 乐观更新状态
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, TaskStatus>>({});

  // 排序相关状态
  const [optimisticTaskOrder, setOptimisticTaskOrder] = useState<Record<TaskStatus, string[]>>({
    [TaskStatus.IDEA]: [],
    [TaskStatus.TODO]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.WAITING]: [],
    [TaskStatus.DONE]: [],
    [TaskStatus.ARCHIVED]: [],
  });

  // 拖拽过程中的状态
  const [dragOverInfo, setDragOverInfo] = useState<{
    overId: string | null;
    overType: 'task' | 'column' | null;
  }>({ overId: null, overType: null });

  // 正在更新状态和位置的任务
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  // 通知系统
  const {
    showSuccess,
    showError,
  } = useGlobalNotifications();

  // 确认对话框
  const { confirmState, showConfirm, hideConfirm } = useConfirm();



  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 移动距离后才开始拖拽
      },
    })
  );

  // 自定义碰撞检测：优先检测任务，然后检测列
  const customCollisionDetection: CollisionDetection = (args) => {
    // 首先尝试检测任务
    const taskCollisions = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        container => container.data.current?.type === "task"
      ),
    });

    if (taskCollisions.length > 0) {
      return taskCollisions;
    }

    // 如果没有任务碰撞，再检测列
    const columnCollisions = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        container => container.data.current?.type === "column"
      ),
    });

    return columnCollisions;
  };

  // 获取所有任务 - 看板需要较新的数据
  const { data: tasksData, isLoading, refetch, isFetching } = api.task.getAll.useQuery(
    { limit: 100 }, // 获取更多任务用于看板显示
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000, // 30秒缓存，确保数据新鲜度
      refetchOnWindowFocus: true, // 窗口聚焦时重新获取，适合工作流程管理
      refetchOnMount: true, // 每次挂载时重新获取
      // 网络重连时重新获取
      refetchOnReconnect: true,
    }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 按状态分组任务（包含乐观更新）
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
        // 检查是否有乐观更新
        const optimisticStatus = optimisticUpdates[task.id];
        const effectiveStatus = optimisticStatus || task.status;

        grouped[effectiveStatus].push({
          ...task,
          status: effectiveStatus, // 使用乐观更新的状态
        } as TaskWithRelations);
      }
    });

    // 应用乐观排序更新
    Object.keys(grouped).forEach((status) => {
      const taskStatus = status as TaskStatus;
      const optimisticOrder = optimisticTaskOrder[taskStatus];

      if (optimisticOrder.length > 0) {
        // 按照乐观更新的顺序重新排列任务
        const taskMap = new Map(grouped[taskStatus].map(task => [task.id, task]));
        const reorderedTasks: TaskWithRelations[] = [];

        // 先添加按乐观顺序排列的任务
        optimisticOrder.forEach(taskId => {
          const task = taskMap.get(taskId);
          if (task) {
            reorderedTasks.push(task);
            taskMap.delete(taskId);
          }
        });

        // 再添加剩余的任务（新任务或未在乐观更新中的任务）
        taskMap.forEach(task => {
          reorderedTasks.push(task);
        });

        grouped[taskStatus] = reorderedTasks;
      }
    });

    return grouped;
  }, [tasksData, optimisticUpdates, optimisticTaskOrder]);



  // 获取tRPC utils用于缓存操作
  const utils = api.useUtils();

  // 任务状态更新
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: (updatedTask, variables) => {
      const columnTitle = KANBAN_COLUMNS.find(col => col.status === variables.status)?.title;
      showSuccess(`任务已移动到"${columnTitle}"`);

      // 清除乐观更新状态
      setOptimisticUpdates(prev => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });

      // 使用缓存更新而不是refetch，避免重新加载
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map(task =>
            task.id === variables.id
              ? { ...task, status: variables.status }
              : task
          )
        };
      });
    },
    onError: (error, variables) => {
      // 立即清除乐观更新状态（回滚）
      setOptimisticUpdates(prev => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });

      showError(`移动失败: ${error.message}`);
    },
  });

  // 时间追踪
  const startTimer = api.task.startTimer.useMutation({
    onSuccess: (_, variables) => {
      // 使用缓存更新
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map(task =>
            task.id === variables.id
              ? { ...task, isTimerActive: true, timerStartedAt: new Date() }
              : task
          )
        };
      });
    },
  });

  const pauseTimer = api.task.pauseTimer.useMutation({
    onSuccess: (_, variables) => {
      // 使用缓存更新
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map(task =>
            task.id === variables.id
              ? { ...task, isTimerActive: false, timerStartedAt: null }
              : task
          )
        };
      });
    },
  });

  // 重新排序任务
  const reorderTasks = api.task.reorder.useMutation({
    onSuccess: () => {
      void refetch();
      showSuccess("任务排序已更新");
    },
    onError: (error) => {
      showError(error.message || "更新任务排序失败");
      // 回滚乐观更新
      setOptimisticTaskOrder({
        [TaskStatus.IDEA]: [],
        [TaskStatus.TODO]: [],
        [TaskStatus.IN_PROGRESS]: [],
        [TaskStatus.WAITING]: [],
        [TaskStatus.DONE]: [],
        [TaskStatus.ARCHIVED]: [],
      });
    },
  });

  // 删除任务
  const deleteTask = api.task.delete.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void utils.task.getAll.invalidate();
    },
    onError: (error) => {
      showError(error.message || "删除任务失败");
    },
  });

  // 带位置的状态更新
  const updateStatusWithPosition = api.task.updateStatusWithPosition.useMutation({
    onSuccess: (_, variables) => {
      // 立即清理更新状态，但保持乐观更新直到数据刷新
      setUpdatingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });

      // 使用 invalidate 而不是 refetch，避免立即清理乐观更新
      void utils.task.getAll.invalidate().then(() => {
        // 数据更新完成后清理乐观更新
        setOptimisticUpdates(prev => {
          const newState = { ...prev };
          delete newState[variables.id];
          return newState;
        });

        setOptimisticTaskOrder({
          [TaskStatus.IDEA]: [],
          [TaskStatus.TODO]: [],
          [TaskStatus.IN_PROGRESS]: [],
          [TaskStatus.WAITING]: [],
          [TaskStatus.DONE]: [],
          [TaskStatus.ARCHIVED]: [],
        });
      });

      showSuccess("任务状态和位置已更新");
    },
    onError: (error, variables) => {
      showError(error.message || "更新任务状态和位置失败");

      // 清理更新状态
      setUpdatingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });

      // 回滚乐观更新
      setOptimisticUpdates(prev => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });

      setOptimisticTaskOrder({
        [TaskStatus.IDEA]: [],
        [TaskStatus.TODO]: [],
        [TaskStatus.IN_PROGRESS]: [],
        [TaskStatus.WAITING]: [],
        [TaskStatus.DONE]: [],
        [TaskStatus.ARCHIVED]: [],
      });
    },
  });

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // 立即进行乐观更新
    setOptimisticUpdates(prev => ({
      ...prev,
      [taskId]: newStatus,
    }));

    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: newStatus,
        note: `状态变更为${KANBAN_COLUMNS.find(col => col.status === newStatus)?.title}`,
      });
    } catch (error) {
      console.error("状态更新失败:", error);
      // 错误处理在mutation的onError中进行
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
    // 任务模态框成功后，使用invalidate来确保数据最新
    void utils.task.getAll.invalidate();
  };

  // 处理删除任务
  const handleDeleteTask = async (taskId: string) => {
    const task = tasksData?.tasks.find(t => t.id === taskId);
    const taskTitle = task?.title || "此任务";

    const confirmed = await showConfirm({
      title: "确认删除任务",
      message: `确定要删除任务"${taskTitle}"吗？\n\n此操作无法撤销，任务的所有相关数据（包括时间记录、状态历史等）都将被永久删除。`,
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      try {
        await deleteTask.mutateAsync({ id: taskId });
      } catch (error) {
        console.error("删除任务失败:", error);
      }
    }
  };

  // 处理快速上浮到第一位
  const handleMoveToTop = async (taskId: string) => {
    const task = tasksData?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentStatusTasks = tasksByStatus[task.status] || [];
    if (currentStatusTasks.length <= 1) return; // 如果只有一个任务或没有任务，无需移动

    // 乐观更新：立即将任务移动到第一位
    const newOrder = [taskId, ...currentStatusTasks.filter(t => t.id !== taskId).map(t => t.id)];
    setOptimisticTaskOrder(prev => ({
      ...prev,
      [task.status]: newOrder,
    }));

    try {
      await updateStatusWithPosition.mutateAsync({
        id: taskId,
        status: task.status,
        insertIndex: 0, // 插入到第一位
        note: "快速上浮到第一位",
      });
    } catch (error) {
      console.error("移动任务失败:", error);
      // 错误处理在mutation的onError中进行
    }
  };

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // 拖拽过程中
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setDragOverInfo({ overId: null, overType: null });
      return;
    }

    const overType = over.data?.current?.type as 'task' | 'column' | undefined;
    setDragOverInfo({
      overId: over.id as string,
      overType: overType || null,
    });
  };

  // 拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDragOverInfo({ overId: null, overType: null });

    if (!over) return;

    const draggedTaskId = active.id as string;
    const overId = over.id as string;

    console.log('拖拽结束:', {
      draggedTaskId,
      overId,
      overType: over.data?.current?.type,
      overData: over.data?.current
    });

    // 如果拖拽到自己身上，不执行任何操作
    if (draggedTaskId === overId) return;

    const draggedTask = Object.values(tasksByStatus)
      .flat()
      .find((task: TaskWithRelations) => task.id === draggedTaskId);

    if (!draggedTask) return;

    const currentStatus = draggedTask.status;

    // 确定目标状态
    let targetStatus: TaskStatus;
    if (over.data?.current?.type === "column") {
      targetStatus = over.data.current.status as TaskStatus;
    } else if (over.data?.current?.type === "task") {
      const targetTask = over.data.current.task as TaskWithRelations;
      targetStatus = targetTask.status;
    } else {
      return;
    }

    // 处理跨状态拖拽
    if (currentStatus !== targetStatus) {
      // 确定在目标状态中的插入位置
      let targetInsertIndex: number | undefined;

      if (over.data?.current?.type === "task") {
        // 拖拽到具体任务上，插入到该任务之前
        const targetStatusTasks = tasksByStatus[targetStatus] || [];
        const targetTaskIndex = targetStatusTasks.findIndex(task => task.id === overId);
        targetInsertIndex = targetTaskIndex !== -1 ? targetTaskIndex : undefined;
      }

      console.log('跨状态拖拽:', {
        draggedTaskId,
        currentStatus,
        targetStatus,
        targetInsertIndex,
        overId
      });

      // 乐观更新UI - 同时更新状态和位置
      setOptimisticUpdates(prev => ({
        ...prev,
        [draggedTaskId]: targetStatus,
      }));

      // 乐观更新排序 - 立即在目标位置显示任务
      if (targetInsertIndex !== undefined) {
        const targetStatusTasks = tasksByStatus[targetStatus] || [];
        const newTaskIds = [...targetStatusTasks.map(t => t.id)];
        newTaskIds.splice(targetInsertIndex, 0, draggedTaskId);

        setOptimisticTaskOrder(prev => ({
          ...prev,
          [targetStatus]: newTaskIds,
        }));
      }

      // 标记任务为更新中
      setUpdatingTasks(prev => new Set(prev).add(draggedTaskId));

      try {
        // 使用新的 API 一次性更新状态和位置
        await updateStatusWithPosition.mutateAsync({
          id: draggedTaskId,
          status: targetStatus,
          insertIndex: targetInsertIndex,
          note: `拖拽到${KANBAN_COLUMNS.find(col => col.status === targetStatus)?.title}`,
        });
      } catch (error) {
        console.error("跨状态拖拽失败:", error);
      }
      return;
    }

    // 处理同状态内的排序
    const statusTasks = tasksByStatus[currentStatus] || [];
    const currentIndex = statusTasks.findIndex(task => task.id === draggedTaskId);

    if (currentIndex === -1) return;

    let newIndex: number;

    if (over.data?.current?.type === "column") {
      // 拖拽到列的空白区域，放到末尾
      newIndex = statusTasks.length - 1;
    } else {
      // 拖拽到具体任务上
      const targetTaskIndex = statusTasks.findIndex(task => task.id === overId);
      if (targetTaskIndex === -1) return;

      console.log('位置计算:', {
        currentIndex,
        targetTaskIndex,
        draggedTaskId,
        targetTaskId: overId,
        statusTasks: statusTasks.map(t => ({ id: t.id, title: t.title }))
      });

      // 简化逻辑：直接使用目标任务的索引作为新位置
      // arrayMove 会自动处理元素移动的细节
      newIndex = targetTaskIndex;
    }

    // 如果位置没有变化，不执行操作
    if (currentIndex === newIndex) return;

    // 计算新的任务顺序
    const reorderedTasks = arrayMove(statusTasks, currentIndex, newIndex);
    const taskIds = reorderedTasks.map(task => task.id);

    // 乐观更新UI
    setOptimisticTaskOrder(prev => ({
      ...prev,
      [currentStatus]: taskIds,
    }));

    try {
      await reorderTasks.mutateAsync({
        taskIds,
        status: currentStatus,
      });
    } catch (error) {
      console.error("拖拽排序失败:", error);
    }
  };

  // 获取当前拖拽的任务
  const activeTask = activeId
    ? Object.values(tasksByStatus).flat().find((task: TaskWithRelations) => task.id === activeId)
    : null;

  // 首次加载显示页面级loading
  if (isLoading) {
    return (
      <AuthGuard>
        <MainLayout>
          <PageLoading message="加载任务看板中..." />
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

        <div className={`space-y-6 transition-all duration-200 ${activeId ? 'bg-gray-50' : ''}`}>
          {/* 拖拽状态指示器 */}
          {activeId && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
              正在拖拽任务 - 拖拽到目标位置释放
            </div>
          )}

          {/* 页面标题和操作 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">任务看板</h1>
                {((isFetching && !isLoading) || reorderTasks.isPending) && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                    {reorderTasks.isPending ? "更新排序中..." : "刷新中..."}
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {activeId
                  ? "拖拽任务到目标位置或列来重新排序或更改状态"
                  : "拖拽任务卡片来更新状态或调整顺序，可视化管理您的工作流程"
                }
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
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
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
                  onDelete={handleDeleteTask}
                  onMoveToTop={handleMoveToTop}
                  formatTimeSpent={formatTimeSpent}
                  isTimerActive={isTimerActive}
                  isUpdating={updateTaskStatus.isPending}
                  optimisticUpdates={optimisticUpdates}
                  updatingTasks={updatingTasks}
                />
              );
            })}
            </div>

            {/* 拖拽覆盖层 */}
            <DragOverlay>
              {activeTask ? (
                <div className="transform rotate-2 opacity-95 scale-105 shadow-2xl">
                  <TaskCard
                    task={activeTask}
                    onStatusChange={() => {}}
                    onStartTimer={() => {}}
                    onPauseTimer={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onMoveToTop={() => {}}
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

        {/* 确认模态框 */}
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={hideConfirm}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          type={confirmState.type}
          isLoading={confirmState.isLoading}
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
  onDelete: (taskId: string) => void;
  onMoveToTop: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  isUpdating: boolean;
  optimisticUpdates: Record<string, TaskStatus>;
  updatingTasks: Set<string>;
}

function KanbanColumn({
  column,
  tasks,
  onStatusChange,
  onStartTimer,
  onPauseTimer,
  onEdit,
  onDelete,
  onMoveToTop,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  optimisticUpdates,
  updatingTasks,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: {
      type: "column",
      status: column.status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed ${column.color} min-h-[600px] transition-all duration-200 ${
        isOver
          ? "border-blue-500 bg-blue-50 shadow-lg scale-[1.02] border-solid"
          : "hover:border-gray-400"
      }`}
    >
      {/* 列标题 */}
      <div className={`${column.headerColor} rounded-t-lg px-4 py-3 border-b`}>
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            {column.title}
          </h3>
          <p className="text-xs text-gray-500">
            {tasks.length} 个任务
          </p>
        </div>
      </div>

      {/* 任务列表 */}
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="p-3 space-y-3 min-h-[500px] flex flex-col">
          {tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveToTop={onMoveToTop}
              formatTimeSpent={formatTimeSpent}
              isTimerActive={isTimerActive(task)}
              isUpdating={!!optimisticUpdates[task.id] || updatingTasks.has(task.id)}
            />
          ))}

          {/* 空白拖拽区域 */}
          <div className="flex-1 min-h-[100px]">
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">暂无任务</p>
                <p className="text-xs text-gray-400 mt-1">拖拽任务到此处</p>
              </div>
            )}
          </div>
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
  onDelete: (taskId: string) => void;
  onMoveToTop: (taskId: string) => void;
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
  onDelete: (taskId: string) => void;
  onMoveToTop: (taskId: string) => void;
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
  onDelete,
  onMoveToTop,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  isDragging = false,
}: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  return (
    <div
      className={`bg-white rounded-lg border p-4 shadow-sm transition-all duration-200 cursor-pointer relative ${
        isDragging
          ? "border-blue-400 shadow-xl bg-blue-50 scale-105 rotate-1 z-50"
          : isUpdating
          ? "border-blue-200 bg-blue-50 animate-pulse"
          : "border-gray-200 hover:shadow-md hover:border-gray-300 hover:scale-[1.02]"
      }`}
      onClick={() => !isDragging && onEdit(task.id)}
    >
      {/* 右上角区域：更新指示器和菜单 */}
      <div className="absolute top-2 right-2 flex items-center space-x-1">
        {/* 更新中的指示器 */}
        {isUpdating && (
          <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
        )}

        {/* 菜单按钮 */}
        {!isDragging && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="更多操作"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </button>

            {/* 下拉菜单 */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onMoveToTop(task.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <ArrowUpIcon className="h-4 w-4 mr-2" />
                    置顶
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(task.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* 任务标题 */}
      <div className="mb-2">
        <h4
          className="text-sm font-medium text-gray-900 line-clamp-3"
          title={task.title}
        >
          {task.title}
        </h4>
      </div>

      {/* 任务描述 */}
      {task.description && (
        <p
          className="text-xs text-gray-600 mb-3 line-clamp-4"
          title={task.description}
        >
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

        {/* 标签显示 */}
        {task.tags.length > 0 && (
          <TagList
            tags={task.tags.map(tagRelation => tagRelation.tag as TagData)}
            size="sm"
            variant="default"
            showIcon={true}
            maxDisplay={4} // 默认显示4个
            expandable={true} // 启用点击展开
            className="flex-wrap"
          />
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

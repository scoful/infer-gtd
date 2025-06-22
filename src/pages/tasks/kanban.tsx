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
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
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
import TaskFeedbackModal from "@/components/Tasks/TaskFeedbackModal";
import TimeEntryModal from "@/components/TimeEntryModal";
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

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 计时明细模态框状态
  const [isTimeEntryModalOpen, setIsTimeEntryModalOpen] = useState(false);
  const [timeEntryTaskId, setTimeEntryTaskId] = useState<string | null>(null);
  const [timeEntryTaskTitle, setTimeEntryTaskTitle] = useState<string>("");

  // 任务反馈模态框状态
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [feedbackTaskTitle, setFeedbackTaskTitle] = useState<string>("");

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

  // 为每个状态管理分页状态
  const [statusLimits, setStatusLimits] = useState<Record<TaskStatus, number>>({
    [TaskStatus.IDEA]: 5,
    [TaskStatus.TODO]: 5,
    [TaskStatus.IN_PROGRESS]: 5,
    [TaskStatus.WAITING]: 5,
    [TaskStatus.DONE]: 5,
    [TaskStatus.ARCHIVED]: 5,
  });

  // 为每个状态单独获取任务数据
  const ideaTasks = api.task.getByStatus.useQuery(
    { status: TaskStatus.IDEA, limit: statusLimits[TaskStatus.IDEA] },
    { enabled: !!sessionData, staleTime: 30 * 1000, refetchOnWindowFocus: true }
  );

  const todoTasks = api.task.getByStatus.useQuery(
    { status: TaskStatus.TODO, limit: statusLimits[TaskStatus.TODO] },
    { enabled: !!sessionData, staleTime: 30 * 1000, refetchOnWindowFocus: true }
  );

  const inProgressTasks = api.task.getByStatus.useQuery(
    { status: TaskStatus.IN_PROGRESS, limit: statusLimits[TaskStatus.IN_PROGRESS] },
    { enabled: !!sessionData, staleTime: 30 * 1000, refetchOnWindowFocus: true }
  );

  const waitingTasks = api.task.getByStatus.useQuery(
    { status: TaskStatus.WAITING, limit: statusLimits[TaskStatus.WAITING] },
    { enabled: !!sessionData, staleTime: 30 * 1000, refetchOnWindowFocus: true }
  );

  const doneTasks = api.task.getByStatus.useQuery(
    { status: TaskStatus.DONE, limit: statusLimits[TaskStatus.DONE] },
    { enabled: !!sessionData, staleTime: 30 * 1000, refetchOnWindowFocus: true }
  );

  // 合并加载状态
  // 只有在真正的初始加载时才显示全屏loading
  // 需要区分初始加载和加载更多操作
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // 检查是否是真正的初始加载（第一次访问页面且没有任何数据）
  const isRealInitialLoading = !sessionData || (!hasInitiallyLoaded && (
    ideaTasks.isLoading || todoTasks.isLoading || inProgressTasks.isLoading || waitingTasks.isLoading || doneTasks.isLoading
  ));

  const isFetching = ideaTasks.isFetching || todoTasks.isFetching || inProgressTasks.isFetching || waitingTasks.isFetching || doneTasks.isFetching;

  // 跟踪初始加载完成状态
  useEffect(() => {
    if (sessionData && !hasInitiallyLoaded) {
      // 检查是否所有查询都已完成初始加载（有数据或加载完成）
      const allQueriesReady = [ideaTasks, todoTasks, inProgressTasks, waitingTasks, doneTasks]
        .every(query => !query.isLoading);

      if (allQueriesReady) {
        setHasInitiallyLoaded(true);
      }
    }
  }, [sessionData, hasInitiallyLoaded, ideaTasks.isLoading, todoTasks.isLoading, inProgressTasks.isLoading, waitingTasks.isLoading, doneTasks.isLoading]);

  // 跟踪不同类型的刷新状态
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // 手动刷新（导航栏点击）
  const [loadingMoreStatuses, setLoadingMoreStatuses] = useState<Set<TaskStatus>>(new Set()); // 正在加载更多的状态

  // 检查是否是手动数据刷新（导航栏点击触发的刷新）
  const isDataRefreshing = isFetching && !isRealInitialLoading && isManualRefreshing;

  // 监听查询状态变化，在刷新完成后重置标志
  useEffect(() => {
    if (isManualRefreshing && !isFetching) {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, isFetching]);

  // 监听加载更多状态变化，在完成后清理对应状态
  useEffect(() => {
    if (loadingMoreStatuses.size > 0 && !isFetching) {
      setLoadingMoreStatuses(new Set());
    }
  }, [loadingMoreStatuses.size, isFetching]);

  // 获取所有任务的helper函数
  const getAllTasks = (): TaskWithRelations[] => {
    return [
      ...(ideaTasks.data?.tasks || []),
      ...(todoTasks.data?.tasks || []),
      ...(inProgressTasks.data?.tasks || []),
      ...(waitingTasks.data?.tasks || []),
      ...(doneTasks.data?.tasks || []),
    ];
  };

  // 刷新所有状态的任务数据
  const refetchAll = async () => {
    setIsManualRefreshing(true); // 标记为手动刷新
    await Promise.all([
      ideaTasks.refetch(),
      todoTasks.refetch(),
      inProgressTasks.refetch(),
      waitingTasks.refetch(),
      doneTasks.refetch(),
    ]);
  };

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetchAll();
  }, [ideaTasks.refetch, todoTasks.refetch, inProgressTasks.refetch, waitingTasks.refetch, doneTasks.refetch]);

  // 按状态分组任务（包含乐观更新）
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskWithRelations[]> = {
      [TaskStatus.IDEA]: [],
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.WAITING]: [],
      [TaskStatus.DONE]: [],
      [TaskStatus.ARCHIVED]: [],
    };

    // 处理每个状态的任务数据
    const processStatusTasks = (tasks: TaskWithRelations[] | undefined, originalStatus: TaskStatus) => {
      if (!tasks) return;

      tasks.forEach((task) => {
        // 检查是否有乐观更新
        const optimisticStatus = optimisticUpdates[task.id];
        const effectiveStatus = optimisticStatus || task.status;

        grouped[effectiveStatus].push({
          ...task,
          status: effectiveStatus, // 使用乐观更新的状态
        } as TaskWithRelations);
      });
    };

    // 处理各状态的任务
    processStatusTasks(ideaTasks.data?.tasks, TaskStatus.IDEA);
    processStatusTasks(todoTasks.data?.tasks, TaskStatus.TODO);
    processStatusTasks(inProgressTasks.data?.tasks, TaskStatus.IN_PROGRESS);
    processStatusTasks(waitingTasks.data?.tasks, TaskStatus.WAITING);
    processStatusTasks(doneTasks.data?.tasks, TaskStatus.DONE);

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
  }, [
    ideaTasks.data,
    todoTasks.data,
    inProgressTasks.data,
    waitingTasks.data,
    doneTasks.data,
    optimisticUpdates,
    optimisticTaskOrder
  ]);



  // 获取tRPC utils用于缓存操作
  const utils = api.useUtils();

  // 任务状态更新
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: (_, variables) => {
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

      // 如果状态变为已完成，触发反馈收集
      if (variables.status === TaskStatus.DONE) {
        // 从所有任务数据中查找任务信息
        const task = getAllTasks().find(t => t.id === variables.id);
        if (task) {
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle(task.title);
          setIsFeedbackModalOpen(true);
        } else {
          // 如果找不到任务，使用默认标题
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle("任务");
          setIsFeedbackModalOpen(true);
        }
      }
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
    onSuccess: (result) => {
      // 更新所有任务的状态，特别是被中断任务的totalTimeSpent
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData || !result.interruptedTasks) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map(task => {
            // 更新被中断任务的totalTimeSpent
            const interruptedTask = result.interruptedTasks?.find(
              (interrupted: any) => interrupted.id === task.id
            );
            if (interruptedTask) {
              return {
                ...task,
                totalTimeSpent: interruptedTask.totalTimeSpent,
                isTimerActive: false,
                timerStartedAt: null,
              };
            }
            return task;
          })
        };
      });

      showSuccess("计时已开始");
    },
    onError: () => {
      showError("开始计时失败");
    },
  });

  const pauseTimer = api.task.pauseTimer.useMutation({
    onSuccess: (result, variables) => {
      // 更新总时长（乐观更新已在handlePauseTimer中处理状态）
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map(task =>
            task.id === variables.id
              ? {
                  ...task,
                  totalTimeSpent: result.task?.totalTimeSpent || task.totalTimeSpent
                }
              : task
          )
        };
      });

      showSuccess("计时已暂停");
    },
    onError: () => {
      showError("暂停计时失败");
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
      void refetchAll();
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

      // 刷新数据并清理乐观更新
      void refetchAll().then(() => {
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

      // 如果状态变为已完成，触发反馈收集
      if (variables.status === TaskStatus.DONE) {
        // 从所有任务数据中查找任务信息
        const allTasks = [
          ...(ideaTasks.data?.tasks || []),
          ...(todoTasks.data?.tasks || []),
          ...(inProgressTasks.data?.tasks || []),
          ...(waitingTasks.data?.tasks || []),
          ...(doneTasks.data?.tasks || []),
        ];
        const task = allTasks.find(t => t.id === variables.id);
        if (task) {
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle(task.title);
          setIsFeedbackModalOpen(true);
        } else {
          // 如果找不到任务，使用默认标题
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle("任务");
          setIsFeedbackModalOpen(true);
        }
      }

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
    const task = getAllTasks().find(t => t.id === taskId);
    if (!task) return;

    // 乐观更新：立即更新UI状态
    utils.task.getAll.setData({ limit: 100 }, (oldData) => {
      if (!oldData) return oldData;

      const now = new Date();

      return {
        ...oldData,
        tasks: oldData.tasks.map(currentTask => {
          if (currentTask.id === taskId) {
            // 开始新的计时
            return { ...currentTask, isTimerActive: true, timerStartedAt: now };
          } else if (currentTask.isTimerActive && currentTask.timerStartedAt) {
            // 停止其他正在计时的任务，并立即计算累计时间
            const sessionDuration = Math.floor(
              (now.getTime() - new Date(currentTask.timerStartedAt).getTime()) / 1000
            );
            return {
              ...currentTask,
              isTimerActive: false,
              timerStartedAt: null,
              totalTimeSpent: currentTask.totalTimeSpent + sessionDuration, // 立即更新累计时间
            };
          }
          return currentTask;
        })
      };
    });

    // 乐观更新：将开始计时的任务移动到第一位
    const currentStatusTasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[task.status] || [];
    const newOrder = [taskId, ...currentStatusTasks.filter((t: TaskWithRelations) => t.id !== taskId).map((t: TaskWithRelations) => t.id)];
    setOptimisticTaskOrder(prev => ({
      ...prev,
      [task.status]: newOrder,
    }));

    try {
      // 先开始计时
      await startTimer.mutateAsync({
        id: taskId,
        description: "开始工作",
      });

      // 然后移动到第一位
      await updateStatusWithPosition.mutateAsync({
        id: taskId,
        status: task.status,
        insertIndex: 0, // 插入到第一位
        note: "开始计时，自动置顶",
      });
    } catch (error) {
      console.error("开始计时失败:", error);
      // 错误时回滚乐观更新
      void refetchAll();
    }
  };

  const handlePauseTimer = async (taskId: string) => {
    // 乐观更新：立即更新UI状态
    utils.task.getAll.setData({ limit: 100 }, (oldData) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        tasks: oldData.tasks.map(task =>
          task.id === taskId
            ? { ...task, isTimerActive: false, timerStartedAt: null }
            : task
        )
      };
    });

    try {
      await pauseTimer.mutateAsync({
        id: taskId,
        description: "暂停工作",
      });
    } catch (error) {
      console.error("暂停计时失败:", error);
      // 错误时回滚乐观更新
      void refetchAll();
    }
  };

  const formatTimeSpent = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // 紧凑的时间格式化（用于空间受限的地方）
  const formatTimeCompact = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const isTimerActive = (task: TaskWithRelations) => {
    // 简化逻辑：只依赖 task.isTimerActive 字段
    // 这个字段在开始/暂停计时时会立即更新
    return task.isTimerActive;
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
    // 任务模态框成功后，刷新所有数据
    void refetchAll();
  };

  // 处理反馈模态框关闭
  const handleFeedbackModalClose = () => {
    setIsFeedbackModalOpen(false);
    setFeedbackTaskId(null);
    setFeedbackTaskTitle("");
  };

  // 处理反馈保存成功
  const handleFeedbackSuccess = () => {
    // 刷新所有状态的数据
    void refetchAll();
    handleFeedbackModalClose();
  };

  // 为特定状态加载更多任务
  const handleLoadMoreForStatus = (status: TaskStatus) => {
    setLoadingMoreStatuses(prev => new Set(prev).add(status)); // 记录正在加载更多的状态
    setStatusLimits(prev => ({
      ...prev,
      [status]: prev[status] + 5,
    }));
  };

  // 获取特定状态是否有更多任务
  const getHasMoreTasksForStatus = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDEA:
        return !!ideaTasks.data?.nextCursor;
      case TaskStatus.TODO:
        return !!todoTasks.data?.nextCursor;
      case TaskStatus.IN_PROGRESS:
        return !!inProgressTasks.data?.nextCursor;
      case TaskStatus.WAITING:
        return !!waitingTasks.data?.nextCursor;
      case TaskStatus.DONE:
        return !!doneTasks.data?.nextCursor;
      default:
        return false;
    }
  };

  // 获取特定状态的加载状态（只有在加载更多时才显示loading）
  const getIsLoadingForStatus = (status: TaskStatus) => {
    // 只有在该状态正在加载更多时才显示loading
    if (!loadingMoreStatuses.has(status)) {
      return false;
    }

    switch (status) {
      case TaskStatus.IDEA:
        return ideaTasks.isFetching;
      case TaskStatus.TODO:
        return todoTasks.isFetching;
      case TaskStatus.IN_PROGRESS:
        return inProgressTasks.isFetching;
      case TaskStatus.WAITING:
        return waitingTasks.isFetching;
      case TaskStatus.DONE:
        return doneTasks.isFetching;
      default:
        return false;
    }
  };

  // 处理删除任务
  const handleDeleteTask = async (taskId: string) => {
    const task = getAllTasks().find(t => t.id === taskId);
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

  // 打开计时明细
  const handleViewTimeEntries = (taskId: string) => {
    const task = getAllTasks().find(t => t.id === taskId);
    if (!task) return;

    setTimeEntryTaskId(taskId);
    setTimeEntryTaskTitle(task.title);
    setIsTimeEntryModalOpen(true);
  };

  // 处理快速上浮到第一位
  const handleMoveToTop = async (taskId: string) => {
    const task = getAllTasks().find(t => t.id === taskId);
    if (!task) return;

    const currentStatusTasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[task.status] || [];
    if (currentStatusTasks.length <= 1) return; // 如果只有一个任务或没有任务，无需移动

    // 乐观更新：立即将任务移动到第一位
    const newOrder = [taskId, ...currentStatusTasks.filter((t: TaskWithRelations) => t.id !== taskId).map((t: TaskWithRelations) => t.id)];
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
    const taskId = event.active.id as string;
    const task = (Object.values(tasksByStatus) as TaskWithRelations[][])
      .flat()
      .find((t) => t.id === taskId);

    // 检查是否正在计时
    if (task && isTimerActive(task)) {
      showError("正在计时的任务无法移动，请先暂停计时");
      return;
    }

    setActiveId(taskId);
  };

  // 拖拽过程中
  const handleDragOver = (_: DragOverEvent) => {
    // 可以在这里添加拖拽过程中的视觉反馈逻辑
  };

  // 拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);


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

    const draggedTask = (Object.values(tasksByStatus) as TaskWithRelations[][])
      .flat()
      .find((task) => task.id === draggedTaskId);

    if (!draggedTask) return;

    // 🚫 检查任务是否正在计时，如果是则禁止移动
    if (isTimerActive(draggedTask)) {
      showError("正在计时的任务无法移动，请先暂停计时");
      return;
    }

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
        const targetStatusTasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[targetStatus] || [];
        const targetTaskIndex = targetStatusTasks.findIndex((task: TaskWithRelations) => task.id === overId);
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
        const targetStatusTasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[targetStatus] || [];
        const newTaskIds = [...targetStatusTasks.map((t: TaskWithRelations) => t.id)];
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
    const statusTasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[currentStatus] || [];
    const currentIndex = statusTasks.findIndex((task: TaskWithRelations) => task.id === draggedTaskId);

    if (currentIndex === -1) return;

    let newIndex: number;

    if (over.data?.current?.type === "column") {
      // 拖拽到列的空白区域，放到末尾
      newIndex = statusTasks.length - 1;
    } else {
      // 拖拽到具体任务上
      const targetTaskIndex = statusTasks.findIndex((task: TaskWithRelations) => task.id === overId);
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
    const taskIds = reorderedTasks.map((task: TaskWithRelations) => task.id);

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
    ? (Object.values(tasksByStatus) as TaskWithRelations[][]).flat().find((task) => task.id === activeId)
    : null;

  // 首次加载显示页面级loading
  if (isRealInitialLoading) {
    return (
      <AuthGuard>
        <MainLayout>
          <PageLoading
            message="加载任务看板中..."
            className="!min-h-[calc(100vh-12rem)] !bg-transparent"
          />
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
                {(isDataRefreshing || reorderTasks.isPending) && (
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
              const tasks = (tasksByStatus as Record<TaskStatus, TaskWithRelations[]>)[column.status] || [];

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
                  onViewTimeEntries={handleViewTimeEntries}
                  formatTimeSpent={formatTimeSpent}
                  isTimerActive={isTimerActive}
                  isUpdating={updateTaskStatus.isPending}
                  optimisticUpdates={optimisticUpdates}
                  updatingTasks={updatingTasks}
                  hasMoreTasks={getHasMoreTasksForStatus(column.status)}
                  isLoadingMore={getIsLoadingForStatus(column.status)}
                  onLoadMore={() => handleLoadMoreForStatus(column.status)}
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
                    onViewTimeEntries={() => {}}
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

        {/* 计时明细模态框 */}
        <TimeEntryModal
          isOpen={isTimeEntryModalOpen}
          onClose={() => setIsTimeEntryModalOpen(false)}
          taskId={timeEntryTaskId || ""}
          taskTitle={timeEntryTaskTitle}
        />

        {/* 任务反馈模态框 */}
        <TaskFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={handleFeedbackModalClose}
          taskId={feedbackTaskId || ""}
          taskTitle={feedbackTaskTitle}
          onSuccess={handleFeedbackSuccess}
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
  onViewTimeEntries: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  isUpdating: boolean;
  optimisticUpdates: Record<string, TaskStatus>;
  updatingTasks: Set<string>;
  // 分页相关
  hasMoreTasks: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  totalTaskCount?: number;
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
  onViewTimeEntries,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  optimisticUpdates,
  updatingTasks,
  hasMoreTasks,
  isLoadingMore,
  onLoadMore,
  totalTaskCount,
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
            {totalTaskCount !== undefined
              ? `显示 ${tasks.length} 个，共 ${totalTaskCount} 个任务`
              : `${tasks.length} 个任务`
            }
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
              onViewTimeEntries={onViewTimeEntries}
              formatTimeSpent={formatTimeSpent}
              isTimerActive={isTimerActive(task)}
              isUpdating={!!optimisticUpdates[task.id] || updatingTasks.has(task.id)}
            />
          ))}

          {/* 加载更多按钮 */}
          {hasMoreTasks && (
            <div className="flex justify-center py-3">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2"></div>
                    加载中...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    加载更多
                  </>
                )}
              </button>
            </div>
          )}

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
  onViewTimeEntries: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
}

function DraggableTaskCard(props: DraggableTaskCardProps) {
  const isTaskTimerActive = props.isTimerActive;

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
    // 禁用正在计时任务的拖拽
    disabled: isTaskTimerActive,
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
      {...(isTaskTimerActive ? {} : attributes)}
      {...(isTaskTimerActive ? {} : listeners)}
      className={isTaskTimerActive ? "cursor-not-allowed" : ""}
      title={isTaskTimerActive ? "正在计时的任务无法移动，请先暂停计时" : ""}
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
  onViewTimeEntries: (taskId: string) => void;
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
  onViewTimeEntries,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  isDragging = false,
}: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [currentSessionTime, setCurrentSessionTime] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // 实时计时器 - 计算当前会话时长
  useEffect(() => {
    if (!isTimerActive || !task.timerStartedAt) {
      setCurrentSessionTime(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const startTime = new Date(task.timerStartedAt!);
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setCurrentSessionTime(elapsed);
    };

    // 立即更新一次
    updateTimer();

    // 每秒更新
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, task.timerStartedAt]);

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

  // 紧凑的时间格式化（用于空间受限的地方）
  const formatTimeCompact = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <div
      className={`group bg-white rounded-lg border p-4 shadow-sm transition-all duration-200 relative ${
        isDragging
          ? "border-blue-400 shadow-xl bg-blue-50 scale-105 rotate-1 z-50 cursor-grabbing"
          : isUpdating
          ? "border-blue-200 bg-blue-50 animate-pulse cursor-pointer"
          : isTimerActive
          ? "border-green-300 bg-green-50 shadow-md cursor-not-allowed"
          : "border-gray-200 hover:shadow-md hover:border-gray-300 hover:scale-[1.02] cursor-pointer"
      }`}
      onClick={() => !isDragging && onEdit(task.id)}
    >
      {/* 正在计时的视觉标识 */}
      {isTimerActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-white shadow-sm"></div>
      )}
      {/* 任务标题和菜单 */}
      <div className="mb-2 flex items-start justify-between">
        <h4
          className="text-sm font-medium text-gray-900 line-clamp-3 flex-1 min-w-0 pr-1"
          title={task.title}
        >
          {task.title}
        </h4>

        {/* 右侧区域：更新指示器和菜单 */}
        <div className="flex items-center flex-shrink-0 -mr-1">
          {/* 更新中的指示器 */}
          {isUpdating && (
            <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent mr-1"></div>
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
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-[60]">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onMoveToTop(task.id);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <ArrowUpIcon className="h-4 w-4 mr-2 text-blue-500" />
                      置顶
                    </button>

                    {/* 计时明细选项 */}
                    {task.totalTimeSpent > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onViewTimeEntries(task.id);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <ChartBarIcon className="h-4 w-4 mr-2 text-green-500" />
                        计时明细
                      </button>
                    )}

                    <div className="border-t border-gray-100"></div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete(task.id);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
      </div>

      {/* 任务描述 */}
      {task.description && (
        <p
          className="text-xs text-gray-600 mb-3 line-clamp-4 pr-8"
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

      {/* 底部信息 - 重新设计为垂直布局 */}
      <div className="space-y-2">
        {/* 第一行：优先级（仅在有优先级时显示） */}
        {task.priority && (
          <div className="flex items-center">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
          </div>
        )}

        {/* 第二行：累计时间信息 */}
        {task.totalTimeSpent > 0 && (
          <div className="flex items-center">
            <span className="text-xs text-gray-500 flex items-center">
              <ClockIcon className="h-3 w-3 mr-1" />
              累计用时 {formatTimeSpent(task.totalTimeSpent)}
            </span>
          </div>
        )}

        {/* 第三行：计时器控制 */}
        {task.status === TaskStatus.IN_PROGRESS && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">计时状态：</span>
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
              className={`relative p-1 rounded-full transition-all duration-200 ${
                isTimerActive
                  ? "text-red-600 hover:bg-red-50 bg-red-50/50"
                  : "text-green-600 hover:bg-green-50 bg-green-50/50"
              } disabled:opacity-50 border ${
                isTimerActive
                  ? "border-red-200 hover:border-red-300"
                  : "border-green-200 hover:border-green-300"
              }`}
              title={isTimerActive
                ? `暂停计时 - 当前已计时 ${formatTimeSpent(currentSessionTime)}，点击暂停`
                : `开始计时 - 开始专注计时${task.totalTimeSpent > 0 ? `（累计已用时 ${formatTimeSpent(task.totalTimeSpent)}）` : ''}`
              }
            >
              {isTimerActive ? (
                <PauseIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}

              {/* 计时动画环 */}
              {isTimerActive && (
                <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-20"></div>
              )}
            </button>
          </div>
        )}

        {/* 第四行：当前计时状态（仅在计时时显示） */}
        {task.status === TaskStatus.IN_PROGRESS && isTimerActive && (
          <div className="flex items-center justify-between bg-green-50 rounded-md px-2 py-1.5 border border-green-200">
            <div className="flex items-center text-xs text-green-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="font-medium">正在计时</span>
            </div>
            <div className="text-xs font-mono text-green-800 font-semibold">
              {formatTimeSpent(currentSessionTime)}
            </div>
          </div>
        )}

        {/* 任务反馈（仅在已完成且有反馈时显示） */}
        {task.status === TaskStatus.DONE && task.feedback && (
          <div className="bg-blue-50 rounded-md px-2 py-1.5 border border-blue-200">
            <div className="flex items-start">
              <span className="text-xs text-blue-600 font-medium mr-1">💭</span>
              <p className="text-xs text-blue-700 line-clamp-3" title={task.feedback}>
                {task.feedback}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanPage;

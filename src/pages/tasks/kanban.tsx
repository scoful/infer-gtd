import { type NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { type Task, TaskStatus, TaskType } from "@prisma/client";
import {
  ArrowPathIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import TaskModal from "@/components/Tasks/TaskModal";
import TaskFeedbackModal from "@/components/Tasks/TaskFeedbackModal";
import TimeEntryModal from "@/components/TimeEntryModal";
import PostponeTaskModal from "@/components/Tasks/PostponeTaskModal";
import { ConfirmModal, PageLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { useConfirm } from "@/hooks";
import { type TagData, TagList } from "@/components/Tags";

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
  feedback?: string | null;
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

  // 延期模态框状态
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [postponeTaskId, setPostponeTaskId] = useState<string | null>(null);
  const [postponeTaskTitle, setPostponeTaskTitle] = useState<string>("");
  const [postponeTaskDueDate, setPostponeTaskDueDate] = useState<Date | null>(
    null,
  );
  const [postponeTaskDueTime, setPostponeTaskDueTime] = useState<string | null>(
    null,
  );

  // 乐观更新状态
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, TaskStatus>
  >({});

  // 排序相关状态
  const [optimisticTaskOrder, setOptimisticTaskOrder] = useState<
    Record<TaskStatus, string[]>
  >({
    [TaskStatus.IDEA]: [],
    [TaskStatus.TODO]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.WAITING]: [],
    [TaskStatus.DONE]: [],
    [TaskStatus.ARCHIVED]: [],
  });

  // 正在更新状态和位置的任务
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  // 计时操作的专用loading状态
  const [timerLoadingTasks, setTimerLoadingTasks] = useState<Set<string>>(
    new Set(),
  );

  // 通知系统
  const { showSuccess, showError } = useGlobalNotifications();

  // 确认对话框
  const { confirmState, showConfirm, hideConfirm } = useConfirm();

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 移动距离后才开始拖拽
      },
    }),
  );

  // 自定义碰撞检测：优先检测任务，然后检测列
  const customCollisionDetection: CollisionDetection = (args) => {
    // 首先尝试检测任务
    const taskCollisions = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === "task",
      ),
    });

    if (taskCollisions.length > 0) {
      return taskCollisions;
    }

    // 如果没有任务碰撞，再检测列
    const columnCollisions = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === "column",
      ),
    });

    return columnCollisions;
  };

  // 为每个状态单独获取任务数据
  // 使用 useInfiniteQuery 来实现真正的分页加载，避免数据清空
  const ideaTasks = api.task.getByStatus.useInfiniteQuery(
    { status: TaskStatus.IDEA, limit: 10 },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const todoTasks = api.task.getByStatus.useInfiniteQuery(
    { status: TaskStatus.TODO, limit: 10 },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const inProgressTasks = api.task.getByStatus.useInfiniteQuery(
    { status: TaskStatus.IN_PROGRESS, limit: 10 },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const waitingTasks = api.task.getByStatus.useInfiniteQuery(
    { status: TaskStatus.WAITING, limit: 10 },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const doneTasks = api.task.getByStatus.useInfiniteQuery(
    { status: TaskStatus.DONE, limit: 10 },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  // 合并加载状态
  // 只有在真正的初始加载时才显示全屏loading
  // 需要区分初始加载和加载更多操作
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // 检查是否是真正的初始加载（第一次访问页面且没有任何数据）
  const isRealInitialLoading =
    !sessionData ||
    (!hasInitiallyLoaded &&
      (ideaTasks.isLoading ||
        todoTasks.isLoading ||
        inProgressTasks.isLoading ||
        waitingTasks.isLoading ||
        doneTasks.isLoading));

  const isFetching =
    ideaTasks.isFetching ||
    todoTasks.isFetching ||
    inProgressTasks.isFetching ||
    waitingTasks.isFetching ||
    doneTasks.isFetching;

  // 跟踪初始加载完成状态
  useEffect(() => {
    if (sessionData && !hasInitiallyLoaded) {
      // 检查是否所有查询都已完成初始加载（有数据或加载完成）
      const allQueriesReady = [
        ideaTasks,
        todoTasks,
        inProgressTasks,
        waitingTasks,
        doneTasks,
      ].every((query) => !query.isLoading);

      if (allQueriesReady) {
        setHasInitiallyLoaded(true);
      }
    }
  }, [
    sessionData,
    hasInitiallyLoaded,
    ideaTasks.isLoading,
    todoTasks.isLoading,
    inProgressTasks.isLoading,
    waitingTasks.isLoading,
    doneTasks.isLoading,
  ]);

  // 跟踪不同类型的刷新状态
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // 手动刷新（导航栏点击）
  const [loadingMoreStatuses, setLoadingMoreStatuses] = useState<
    Set<TaskStatus>
  >(new Set()); // 正在加载更多的状态

  // 检查是否是手动数据刷新（导航栏点击触发的刷新）
  const isDataRefreshing =
    isFetching && !isRealInitialLoading && isManualRefreshing;

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
    const flattenPages = (pages: any[] | undefined) => {
      if (!pages) return [];
      return pages.flatMap((page) => page.tasks ?? []);
    };

    const allTasks = [
      ...flattenPages(ideaTasks.data?.pages),
      ...flattenPages(todoTasks.data?.pages),
      ...flattenPages(inProgressTasks.data?.pages),
      ...flattenPages(waitingTasks.data?.pages),
      ...flattenPages(doneTasks.data?.pages),
    ];

    // 应用乐观更新状态
    return allTasks.map((task) => {
      const optimisticStatus = optimisticUpdates[task.id];
      if (optimisticStatus) {
        return { ...task, status: optimisticStatus };
      }
      return task;
    });
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
  }, [
    ideaTasks.refetch,
    todoTasks.refetch,
    inProgressTasks.refetch,
    waitingTasks.refetch,
    doneTasks.refetch,
  ]);

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
    const processStatusTasks = (
      pages: any[] | undefined,
      _originalStatus: TaskStatus,
    ) => {
      if (!pages) return;

      const tasks = pages.flatMap((page) => page.tasks ?? []);
      tasks.forEach((task) => {
        // 检查是否有乐观更新
        const optimisticStatus = optimisticUpdates[task.id];
        const effectiveStatus = optimisticStatus ?? task.status;

        (grouped as any)[effectiveStatus].push({
          ...task,
          status: effectiveStatus, // 使用乐观更新的状态
        } as TaskWithRelations);
      });
    };

    // 处理各状态的任务
    processStatusTasks(ideaTasks.data?.pages, TaskStatus.IDEA);
    processStatusTasks(todoTasks.data?.pages, TaskStatus.TODO);
    processStatusTasks(inProgressTasks.data?.pages, TaskStatus.IN_PROGRESS);
    processStatusTasks(waitingTasks.data?.pages, TaskStatus.WAITING);
    processStatusTasks(doneTasks.data?.pages, TaskStatus.DONE);

    // 应用乐观排序更新
    Object.keys(grouped).forEach((status) => {
      const taskStatus = status as TaskStatus;
      const optimisticOrder = optimisticTaskOrder[taskStatus];

      if (optimisticOrder.length > 0) {
        // 按照乐观更新的顺序重新排列任务
        const taskMap = new Map(
          grouped[taskStatus].map((task) => [task.id, task]),
        );
        const reorderedTasks: TaskWithRelations[] = [];

        // 先添加按乐观顺序排列的任务
        optimisticOrder.forEach((taskId) => {
          const task = taskMap.get(taskId);
          if (task) {
            reorderedTasks.push(task);
            taskMap.delete(taskId);
          }
        });

        // 再添加剩余的任务（新任务或未在乐观更新中的任务）
        taskMap.forEach((task) => {
          reorderedTasks.push(task);
        });

        grouped[taskStatus] = reorderedTasks;
      }
    });

    return grouped;
  }, [
    ideaTasks.data?.pages,
    todoTasks.data?.pages,
    inProgressTasks.data?.pages,
    waitingTasks.data?.pages,
    doneTasks.data?.pages,
    optimisticUpdates,
    optimisticTaskOrder,
  ]);

  // 获取tRPC utils用于缓存操作
  const utils = api.useUtils();

  // 任务状态更新
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: (_, variables) => {
      const columnTitle = KANBAN_COLUMNS.find(
        (col) => col.status === variables.status,
      )?.title;
      showSuccess(`任务已移动到"${columnTitle}"`);

      // 清除乐观更新状态
      setOptimisticUpdates((prev) => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });

      // 使用缓存更新而不是refetch，避免重新加载
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map((task) =>
            task.id === variables.id
              ? { ...task, status: variables.status }
              : task,
          ),
        };
      });

      // 如果状态变为已完成，触发反馈收集
      if (variables.status === TaskStatus.DONE) {
        // 从所有任务数据中查找任务信息
        const task = getAllTasks().find((t) => t.id === variables.id);
        console.log("查找任务反馈信息:", {
          taskId: variables.id,
          task: task,
          allTasksCount: getAllTasks().length,
        });
        if (task) {
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle(task.title);
          setIsFeedbackModalOpen(true);
        } else {
          // 如果找不到任务，使用默认标题
          console.warn("未找到任务，使用默认标题:", variables.id);
          setFeedbackTaskId(variables.id);
          setFeedbackTaskTitle("任务");
          setIsFeedbackModalOpen(true);
        }
      }
    },
    onError: (error, variables) => {
      // 立即清除乐观更新状态（回滚）
      setOptimisticUpdates((prev) => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });

      showError(`移动失败: ${error.message}`);
    },
  });

  // 时间追踪
  const startTimer = api.task.startTimer.useMutation({
    onMutate: (variables) => {
      // 开始loading状态
      setTimerLoadingTasks((prev) => new Set(prev).add(variables.id));
    },
    onSuccess: (result, variables) => {
      // 清除loading状态
      setTimerLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });

      // 更新所有任务的状态，特别是被中断任务的totalTimeSpent
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData || !result.interruptedTasks) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map((task) => {
            // 更新被中断任务的totalTimeSpent
            const interruptedTask = result.interruptedTasks?.find(
              (interrupted: any) => interrupted.id === task.id,
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
          }),
        };
      });

      showSuccess("计时已开始");
    },
    onError: (error, variables) => {
      // 清除loading状态
      setTimerLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });
      showError("开始计时失败");
    },
  });

  const pauseTimer = api.task.pauseTimer.useMutation({
    onMutate: (variables) => {
      // 开始loading状态
      setTimerLoadingTasks((prev) => new Set(prev).add(variables.id));
    },
    onSuccess: (result, variables) => {
      // 清除loading状态
      setTimerLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });

      // 更新总时长（乐观更新已在handlePauseTimer中处理状态）
      utils.task.getAll.setData({ limit: 100 }, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          tasks: oldData.tasks.map((task) =>
            task.id === variables.id
              ? {
                  ...task,
                  totalTimeSpent:
                    result.task?.totalTimeSpent ?? task.totalTimeSpent,
                  isTimerActive: false,
                  timerStartedAt: null,
                }
              : task,
          ),
        };
      });

      // 刷新所有数据以确保状态同步
      void refetchAll();

      showSuccess("计时已暂停");
    },
    onError: (error, variables) => {
      // 清除loading状态
      setTimerLoadingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(variables.id);
        return newSet;
      });
      showError("暂停计时失败");
    },
  });

  // 重新排序任务
  const reorderTasks = api.task.reorder.useMutation({
    onSuccess: () => {
      void refetchAll();
      showSuccess("任务排序已更新");
    },
    onError: (error) => {
      showError(error.message ?? "更新任务排序失败");
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
      showError(error.message ?? "删除任务失败");
    },
  });

  // 重新安排任务（复制任务到待办）
  const duplicateTask = api.task.duplicateTask.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void refetchAll();
    },
    onError: (error) => {
      showError(error.message ?? "重新安排任务失败");
    },
  });

  // 带位置的状态更新
  const updateStatusWithPosition =
    api.task.updateStatusWithPosition.useMutation({
      onSuccess: (_, variables) => {
        // 立即清理更新状态，但保持乐观更新直到数据刷新
        setUpdatingTasks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(variables.id);
          return newSet;
        });

        // 刷新数据并清理乐观更新
        void refetchAll().then(() => {
          // 数据更新完成后清理乐观更新
          setOptimisticUpdates((prev) => {
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
          // 从所有任务数据中查找任务信息，优先从tasksByStatus中查找
          let task = Object.values(tasksByStatus)
            .flat()
            .find((t) => t.id === variables.id);

          // 如果在tasksByStatus中找不到，再从getAllTasks中查找
          task ??= getAllTasks().find((t) => t.id === variables.id);

          console.log("拖拽完成查找任务反馈信息:", {
            taskId: variables.id,
            task: task,
            taskTitle: task?.title,
            allTasksCount: getAllTasks().length,
            tasksByStatusCount: Object.values(tasksByStatus).flat().length,
          });

          if (task) {
            setFeedbackTaskId(variables.id);
            setFeedbackTaskTitle(task.title);
            setIsFeedbackModalOpen(true);
          } else {
            // 如果找不到任务，使用默认标题
            console.warn("拖拽完成未找到任务，使用默认标题:", variables.id);
            setFeedbackTaskId(variables.id);
            setFeedbackTaskTitle("任务");
            setIsFeedbackModalOpen(true);
          }
        }

        showSuccess("任务状态和位置已更新");
      },
      onError: (error, variables) => {
        showError(error.message ?? "更新任务状态和位置失败");

        // 清理更新状态
        setUpdatingTasks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(variables.id);
          return newSet;
        });

        // 回滚乐观更新
        setOptimisticUpdates((prev) => {
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
    setOptimisticUpdates((prev) => ({
      ...prev,
      [taskId]: newStatus,
    }));

    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: newStatus,
        note: `状态变更为${KANBAN_COLUMNS.find((col) => col.status === newStatus)?.title}`,
      });
    } catch (error) {
      console.error("状态更新失败:", error);
      // 错误处理在mutation的onError中进行
    }
  };

  const handleStartTimer = async (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    // 乐观更新：立即更新UI状态
    utils.task.getAll.setData({ limit: 100 }, (oldData) => {
      if (!oldData) return oldData;

      const now = new Date();

      return {
        ...oldData,
        tasks: oldData.tasks.map((currentTask) => {
          if (currentTask.id === taskId) {
            // 开始新的计时
            return { ...currentTask, isTimerActive: true, timerStartedAt: now };
          } else if (currentTask.isTimerActive && currentTask.timerStartedAt) {
            // 停止其他正在计时的任务，并立即计算累计时间
            const sessionDuration = Math.floor(
              (now.getTime() - new Date(currentTask.timerStartedAt).getTime()) /
                1000,
            );
            return {
              ...currentTask,
              isTimerActive: false,
              timerStartedAt: null,
              totalTimeSpent: currentTask.totalTimeSpent + sessionDuration, // 立即更新累计时间
            };
          }
          return currentTask;
        }),
      };
    });

    // 乐观更新：将开始计时的任务移动到第一位
    const currentStatusTasks = tasksByStatus[task.status] ?? [];
    const newOrder = [
      taskId,
      ...currentStatusTasks
        .filter((t: TaskWithRelations) => t.id !== taskId)
        .map((t: TaskWithRelations) => t.id),
    ];
    setOptimisticTaskOrder((prev) => ({
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
        tasks: oldData.tasks.map((task) =>
          task.id === taskId
            ? { ...task, isTimerActive: false, timerStartedAt: null }
            : task,
        ),
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
    setLoadingMoreStatuses((prev) => new Set(prev).add(status)); // 记录正在加载更多的状态

    // 根据状态调用对应的 fetchNextPage
    switch (status) {
      case TaskStatus.IDEA:
        void ideaTasks.fetchNextPage();
        break;
      case TaskStatus.TODO:
        void todoTasks.fetchNextPage();
        break;
      case TaskStatus.IN_PROGRESS:
        void inProgressTasks.fetchNextPage();
        break;
      case TaskStatus.WAITING:
        void waitingTasks.fetchNextPage();
        break;
      case TaskStatus.DONE:
        void doneTasks.fetchNextPage();
        break;
    }
  };

  // 获取特定状态是否有更多任务
  const getHasMoreTasksForStatus = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDEA:
        return ideaTasks.hasNextPage;
      case TaskStatus.TODO:
        return todoTasks.hasNextPage;
      case TaskStatus.IN_PROGRESS:
        return inProgressTasks.hasNextPage;
      case TaskStatus.WAITING:
        return waitingTasks.hasNextPage;
      case TaskStatus.DONE:
        return doneTasks.hasNextPage;
      default:
        return false;
    }
  };

  // 获取特定状态的总任务数
  const getTotalTaskCountForStatus = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.IDEA:
        return ideaTasks.data?.pages?.[0]?.totalCount ?? 0;
      case TaskStatus.TODO:
        return todoTasks.data?.pages?.[0]?.totalCount ?? 0;
      case TaskStatus.IN_PROGRESS:
        return inProgressTasks.data?.pages?.[0]?.totalCount ?? 0;
      case TaskStatus.WAITING:
        return waitingTasks.data?.pages?.[0]?.totalCount ?? 0;
      case TaskStatus.DONE:
        return doneTasks.data?.pages?.[0]?.totalCount ?? 0;
      default:
        return 0;
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
        return ideaTasks.isFetchingNextPage;
      case TaskStatus.TODO:
        return todoTasks.isFetchingNextPage;
      case TaskStatus.IN_PROGRESS:
        return inProgressTasks.isFetchingNextPage;
      case TaskStatus.WAITING:
        return waitingTasks.isFetchingNextPage;
      case TaskStatus.DONE:
        return doneTasks.isFetchingNextPage;
      default:
        return false;
    }
  };

  // 处理删除任务
  const handleDeleteTask = async (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    const taskTitle = task?.title ?? "此任务";

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
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    setTimeEntryTaskId(taskId);
    setTimeEntryTaskTitle(task.title);
    setIsTimeEntryModalOpen(true);
  };

  // 打开延期模态框
  const handlePostponeTask = (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    // 只有限时任务才能调整时间
    if (task.type !== TaskType.DEADLINE) {
      showError("只有限时任务才能调整时间");
      return;
    }

    // 只有待办、进行中、等待中的任务才能调整时间
    const allowedStatuses: TaskStatus[] = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.WAITING,
    ];
    if (!allowedStatuses.includes(task.status)) {
      showError("只有待办、进行中、等待中的任务才能调整时间");
      return;
    }

    setPostponeTaskId(taskId);
    setPostponeTaskTitle(task.title);
    setPostponeTaskDueDate(task.dueDate);
    setPostponeTaskDueTime(task.dueTime);
    setIsPostponeModalOpen(true);
  };

  // 补充反馈
  const handleAddFeedback = (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    setFeedbackTaskId(taskId);
    setFeedbackTaskTitle(task.title);
    setIsFeedbackModalOpen(true);
  };

  // 处理快速上浮到第一位
  const handleMoveToTop = async (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    const currentStatusTasks = tasksByStatus[task.status] ?? [];
    if (currentStatusTasks.length <= 1) return; // 如果只有一个任务或没有任务，无需移动

    // 乐观更新：立即将任务移动到第一位
    const newOrder = [
      taskId,
      ...currentStatusTasks
        .filter((t: TaskWithRelations) => t.id !== taskId)
        .map((t: TaskWithRelations) => t.id),
    ];
    setOptimisticTaskOrder((prev) => ({
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

  // 处理重新安排任务
  const handleDuplicateTask = async (taskId: string) => {
    const task = getAllTasks().find((t) => t.id === taskId);
    if (!task) return;

    try {
      await duplicateTask.mutateAsync({ id: taskId });
    } catch (error) {
      console.error("重新安排任务失败:", error);
      // 错误处理在mutation的onError中进行
    }
  };

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = Object.values(tasksByStatus)
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

    console.log("拖拽结束:", {
      draggedTaskId,
      overId,
      overType: over.data?.current?.type,
      overData: over.data?.current,
    });

    // 如果拖拽到自己身上，不执行任何操作
    if (draggedTaskId === overId) return;

    const draggedTask = Object.values(tasksByStatus)
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
        const targetStatusTasks = tasksByStatus[targetStatus] ?? [];
        const targetTaskIndex = targetStatusTasks.findIndex(
          (task: TaskWithRelations) => task.id === overId,
        );
        targetInsertIndex =
          targetTaskIndex !== -1 ? targetTaskIndex : undefined;
      }

      console.log("跨状态拖拽:", {
        draggedTaskId,
        currentStatus,
        targetStatus,
        targetInsertIndex,
        overId,
      });

      // 乐观更新UI - 同时更新状态和位置
      setOptimisticUpdates((prev) => ({
        ...prev,
        [draggedTaskId]: targetStatus,
      }));

      // 乐观更新排序 - 立即在目标位置显示任务
      if (targetInsertIndex !== undefined) {
        const targetStatusTasks = tasksByStatus[targetStatus] ?? [];
        const newTaskIds = [
          ...targetStatusTasks.map((t: TaskWithRelations) => t.id),
        ];
        newTaskIds.splice(targetInsertIndex, 0, draggedTaskId);

        setOptimisticTaskOrder((prev) => ({
          ...prev,
          [targetStatus]: newTaskIds,
        }));
      }

      // 标记任务为更新中
      setUpdatingTasks((prev) => new Set(prev).add(draggedTaskId));

      try {
        // 使用新的 API 一次性更新状态和位置
        await updateStatusWithPosition.mutateAsync({
          id: draggedTaskId,
          status: targetStatus,
          insertIndex: targetInsertIndex,
          note: `拖拽到${KANBAN_COLUMNS.find((col) => col.status === targetStatus)?.title}`,
        });
      } catch (error) {
        console.error("跨状态拖拽失败:", error);
      }
      return;
    }

    // 处理同状态内的排序
    const statusTasks = tasksByStatus[currentStatus] ?? [];
    const currentIndex = statusTasks.findIndex(
      (task: TaskWithRelations) => task.id === draggedTaskId,
    );

    if (currentIndex === -1) return;

    let newIndex: number;

    if (over.data?.current?.type === "column") {
      // 拖拽到列的空白区域，放到末尾
      newIndex = statusTasks.length - 1;
    } else {
      // 拖拽到具体任务上
      const targetTaskIndex = statusTasks.findIndex(
        (task: TaskWithRelations) => task.id === overId,
      );
      if (targetTaskIndex === -1) return;

      console.log("位置计算:", {
        currentIndex,
        targetTaskIndex,
        draggedTaskId,
        targetTaskId: overId,
        statusTasks: statusTasks.map((t) => ({ id: t.id, title: t.title })),
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
    setOptimisticTaskOrder((prev) => ({
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
    ? Object.values(tasksByStatus)
        .flat()
        .find((task) => task.id === activeId)
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
          <title>任务看板 | Infer GTD</title>
          <meta name="description" content="可视化任务管理看板" />
        </Head>

        <div
          className={`space-y-6 transition-all duration-200 ${activeId ? "bg-gray-50" : ""}`}
        >
          {/* 拖拽状态指示器 */}
          {activeId && (
            <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
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
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    {reorderTasks.isPending ? "更新排序中..." : "刷新中..."}
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {activeId
                  ? "拖拽任务到目标位置或列来重新排序或更改状态"
                  : "拖拽任务卡片来更新状态或调整顺序，可视化管理您的工作流程"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateTask}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="mr-1.5 -ml-0.5 h-5 w-5" />
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
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
              {KANBAN_COLUMNS.map((column) => {
                const tasks = tasksByStatus[column.status] ?? [];

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
                    onDuplicateTask={handleDuplicateTask}
                    onAddFeedback={handleAddFeedback}
                    onPostponeTask={handlePostponeTask}
                    formatTimeSpent={formatTimeSpent}
                    isTimerActive={isTimerActive}
                    isUpdating={updateTaskStatus.isPending}
                    optimisticUpdates={optimisticUpdates}
                    updatingTasks={updatingTasks}
                    timerLoadingTasks={timerLoadingTasks}
                    hasMoreTasks={getHasMoreTasksForStatus(column.status)}
                    isLoadingMore={getIsLoadingForStatus(column.status)}
                    onLoadMore={() => handleLoadMoreForStatus(column.status)}
                    totalTaskCount={getTotalTaskCountForStatus(column.status)}
                  />
                );
              })}
            </div>

            {/* 拖拽覆盖层 */}
            <DragOverlay>
              {activeTask ? (
                <div className="scale-105 rotate-2 transform opacity-95 shadow-2xl">
                  <TaskCard
                    task={activeTask}
                    onStatusChange={() => {}}
                    onStartTimer={() => {}}
                    onPauseTimer={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onMoveToTop={() => {}}
                    onViewTimeEntries={() => {}}
                    onDuplicateTask={() => {}}
                    onAddFeedback={() => {}}
                    onPostponeTask={() => {}}
                    formatTimeSpent={formatTimeSpent}
                    isTimerActive={isTimerActive(activeTask)}
                    isUpdating={false}
                    isTimerLoading={false}
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
          taskId={editingTaskId ?? undefined}
          onSuccess={handleTaskModalSuccess}
        />

        {/* 计时明细模态框 */}
        <TimeEntryModal
          isOpen={isTimeEntryModalOpen}
          onClose={() => setIsTimeEntryModalOpen(false)}
          taskId={timeEntryTaskId ?? ""}
          taskTitle={timeEntryTaskTitle}
        />

        {/* 任务反馈模态框 */}
        <TaskFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={handleFeedbackModalClose}
          taskId={feedbackTaskId ?? ""}
          taskTitle={feedbackTaskTitle}
          onSuccess={handleFeedbackSuccess}
        />

        {/* 延期任务模态框 */}
        <PostponeTaskModal
          isOpen={isPostponeModalOpen}
          onClose={() => setIsPostponeModalOpen(false)}
          taskId={postponeTaskId ?? ""}
          taskTitle={postponeTaskTitle}
          currentDueDate={postponeTaskDueDate}
          currentDueTime={postponeTaskDueTime}
          onSuccess={() => {
            void refetchAll();
          }}
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
  onDuplicateTask: (taskId: string) => void; // 新增：重新安排任务
  onAddFeedback: (taskId: string) => void; // 新增：补充反馈
  onPostponeTask: (taskId: string) => void; // 新增：延期任务
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  isUpdating: boolean;
  optimisticUpdates: Record<string, TaskStatus>;
  updatingTasks: Set<string>;
  timerLoadingTasks: Set<string>; // 新增：计时loading状态
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
  onDuplicateTask,
  onAddFeedback,
  onPostponeTask,
  formatTimeSpent,
  isTimerActive,
  isUpdating: _isUpdating,
  optimisticUpdates,
  updatingTasks,
  timerLoadingTasks,
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
          ? "scale-[1.02] border-solid border-blue-500 bg-blue-50 shadow-lg"
          : "hover:border-gray-400"
      }`}
    >
      {/* 列标题 */}
      <div className={`${column.headerColor} rounded-t-lg border-b px-4 py-3`}>
        <div>
          <h3 className="text-sm font-medium text-gray-900">{column.title}</h3>
          <p className="text-xs text-gray-500">
            {totalTaskCount !== undefined
              ? `${tasks.length}/${totalTaskCount} 个任务`
              : `${tasks.length} 个任务`}
          </p>
        </div>
      </div>

      {/* 任务列表 */}
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[500px] flex-col space-y-3 p-3">
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
              onDuplicateTask={onDuplicateTask}
              onAddFeedback={onAddFeedback}
              onPostponeTask={onPostponeTask}
              formatTimeSpent={formatTimeSpent}
              isTimerActive={isTimerActive(task)}
              isUpdating={
                !!optimisticUpdates[task.id] || updatingTasks.has(task.id)
              }
              isTimerLoading={timerLoadingTasks.has(task.id)}
            />
          ))}

          {/* 加载更多按钮 */}
          {hasMoreTasks && (
            <div className="px-1 py-2">
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className={`group relative w-full overflow-hidden rounded-lg border-2 border-dashed transition-all duration-200 ${
                  isLoadingMore
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
                } disabled:cursor-not-allowed`}
              >
                <div className="flex flex-col items-center justify-center px-4 py-6">
                  {isLoadingMore ? (
                    <>
                      <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="text-sm font-medium text-blue-700">
                        加载中...
                      </span>
                      <span className="mt-1 text-xs text-blue-600">
                        正在获取更多任务
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors duration-200 group-hover:bg-blue-100">
                        <svg
                          className="h-5 w-5 text-gray-500 transition-colors duration-200 group-hover:text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700 transition-colors duration-200 group-hover:text-blue-700">
                        加载更多任务
                      </span>
                      <span className="mt-1 text-xs text-gray-500 transition-colors duration-200 group-hover:text-blue-600">
                        点击查看更多内容
                      </span>
                    </>
                  )}
                </div>

                {/* 悬停效果 */}
                {!isLoadingMore && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"></div>
                )}
              </button>
            </div>
          )}

          {/* 空白拖拽区域 */}
          <div className="min-h-[100px] flex-1">
            {tasks.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">暂无任务</p>
                <p className="mt-1 text-xs text-gray-400">拖拽任务到此处</p>
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
  onDuplicateTask: (taskId: string) => void; // 新增：重新安排任务
  onAddFeedback: (taskId: string) => void; // 新增：补充反馈
  onPostponeTask: (taskId: string) => void; // 新增：延期任务
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
  isTimerLoading: boolean; // 新增：计时loading状态
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
  onDuplicateTask: (taskId: string) => void; // 新增：重新安排任务
  onAddFeedback: (taskId: string) => void; // 新增：补充反馈
  onPostponeTask: (taskId: string) => void; // 新增：延期任务
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
  isTimerLoading: boolean; // 新增：计时操作的loading状态
  isDragging?: boolean;
}

function TaskCard({
  task,
  onStatusChange: _onStatusChange,
  onStartTimer,
  onPauseTimer,
  onEdit,
  onDelete,
  onMoveToTop,
  onViewTimeEntries,
  onDuplicateTask,
  onAddFeedback,
  onPostponeTask,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
  isTimerLoading,
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  // 计算限时任务的剩余时间和紧急程度
  const getDeadlineInfo = (task: TaskWithRelations) => {
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

  // 限时任务的样式配置（方案A：渐进式增强）
  const getDeadlineCardStyles = () => {
    if (
      task.type !== TaskType.DEADLINE ||
      !deadlineInfo ||
      task.status === TaskStatus.DONE
    ) {
      return "";
    }

    const urgencyStyles = {
      overdue: "border-l-4 border-red-600 bg-red-50",
      critical: "border-l-4 border-red-500 bg-red-25",
      urgent: "border-l-4 border-orange-500 bg-orange-25",
      warning: "border-l-4 border-yellow-500 bg-yellow-25",
      normal: "border-l-4 border-blue-500 bg-blue-25",
    };

    return urgencyStyles[deadlineInfo.urgencyLevel];
  };

  return (
    <div
      className={`group relative rounded-lg border p-4 shadow-sm transition-all duration-200 ${
        isDragging
          ? "z-50 scale-105 rotate-1 cursor-grabbing border-blue-400 bg-blue-50 shadow-xl"
          : isUpdating
            ? "animate-pulse cursor-pointer border-blue-200 bg-blue-50"
            : isTimerActive
              ? "cursor-not-allowed border-green-300 bg-green-50 shadow-md"
              : showMenu
                ? task.type === TaskType.DEADLINE && deadlineInfo
                  ? `${getDeadlineCardStyles()} z-40 cursor-pointer shadow-lg`
                  : "z-40 cursor-pointer border-gray-200 border-gray-300 bg-white shadow-md"
                : task.type === TaskType.DEADLINE && deadlineInfo
                  ? `${getDeadlineCardStyles()} cursor-pointer hover:scale-[1.02] hover:shadow-lg`
                  : "cursor-pointer border-gray-200 bg-white hover:scale-[1.02] hover:border-gray-300 hover:shadow-md"
      }`}
      onClick={() => !isDragging && onEdit(task.id)}
    >
      {/* 正在计时的视觉标识 */}
      {isTimerActive && (
        <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-green-500 shadow-sm"></div>
      )}

      {/* 任务标题和菜单 */}
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-1">
          <h4
            className="mb-1 line-clamp-3 text-sm font-medium text-gray-900"
            title={task.title}
          >
            {task.title}
          </h4>
        </div>

        {/* 右侧区域：更新指示器和菜单 */}
        <div className="-mr-1 flex flex-shrink-0 items-center">
          {/* 更新中的指示器 */}
          {isUpdating && (
            <div className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
          )}

          {/* 菜单按钮 */}
          {!isDragging && (
            <div ref={menuRef} className="relative z-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="z-50 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="更多操作"
              >
                <EllipsisVerticalIcon className="h-4 w-4" />
              </button>

              {/* 下拉菜单 */}
              {showMenu && (
                <div className="absolute top-full right-0 z-50 mt-1 w-32 rounded-md border border-gray-200 bg-white shadow-xl">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onMoveToTop(task.id);
                      }}
                      className="flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <ArrowUpIcon className="mr-2 h-4 w-4 text-blue-500" />
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
                        className="flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        <ChartBarIcon className="mr-2 h-4 w-4 text-green-500" />
                        计时明细
                      </button>
                    )}

                    {/* 延期选项 - 仅在待办、进行中、等待中的限时任务中显示 */}
                    {(task.status === TaskStatus.TODO ||
                      task.status === TaskStatus.IN_PROGRESS ||
                      task.status === TaskStatus.WAITING) &&
                      task.type === TaskType.DEADLINE && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            onPostponeTask(task.id);
                          }}
                          className="flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          <ClockIcon className="mr-2 h-4 w-4 text-orange-500" />
                          调整时间
                        </button>
                      )}

                    {/* 补充反馈选项 - 仅在已完成任务中显示 */}
                    {task.status === TaskStatus.DONE && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onAddFeedback(task.id);
                        }}
                        className="flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        <ChatBubbleLeftEllipsisIcon className="mr-2 h-4 w-4 text-green-500" />
                        补充反馈
                      </button>
                    )}

                    {/* 重新安排选项 - 仅在已完成任务中显示 */}
                    {task.status === TaskStatus.DONE && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onDuplicateTask(task.id);
                        }}
                        className="flex w-full items-center px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        <ArrowPathIcon className="mr-2 h-4 w-4 text-blue-500" />
                        重新安排
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
                      className="flex w-full items-center px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
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
          className="mb-3 line-clamp-4 pr-8 text-xs text-gray-600"
          title={task.description}
        >
          {task.description}
        </p>
      )}

      {/* 限时任务的倒计时显示 - 移动到描述下方，已完成任务不显示倒计时 */}
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

      {/* 已完成的限时任务只显示截止时间，不显示倒计时 */}
      {task.type === TaskType.DEADLINE &&
        task.status === TaskStatus.DONE &&
        task.dueDate && (
          <div className="mb-3">
            <div className="text-xs text-gray-500">
              截止时间：
              {new Date(task.dueDate).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
              {task.dueTime ? ` ${task.dueTime}` : " 全天"}
            </div>
          </div>
        )}

      {/* 标签和项目 */}
      <div className="mb-3 flex flex-wrap gap-1">
        {task.project && (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: task.project.color
                ? `${task.project.color}20`
                : "#f3f4f6",
              color: task.project.color ?? "#374151",
            }}
          >
            {task.project.name}
          </span>
        )}

        {/* 标签显示 */}
        {task.tags.length > 0 && (
          <TagList
            tags={task.tags.map((tagRelation) => tagRelation.tag as TagData)}
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
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>
        )}

        {/* 第二行：累计时间信息 */}
        {task.totalTimeSpent > 0 && (
          <div className="flex items-center">
            <span className="flex items-center text-xs text-gray-500">
              <ClockIcon className="mr-1 h-3 w-3" />
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
              disabled={isTimerLoading || isUpdating}
              className={`relative rounded-full p-1 transition-all duration-200 ${
                isTimerLoading
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : isTimerActive
                    ? "bg-red-50/50 text-red-600 hover:bg-red-50"
                    : "bg-green-50/50 text-green-600 hover:bg-green-50"
              } border disabled:opacity-50 ${
                isTimerLoading
                  ? "border-blue-200"
                  : isTimerActive
                    ? "border-red-200 hover:border-red-300"
                    : "border-green-200 hover:border-green-300"
              }`}
              title={
                isTimerLoading
                  ? "计时操作处理中..."
                  : isTimerActive
                    ? `暂停计时 - 当前已计时 ${formatTimeSpent(currentSessionTime)}，点击暂停`
                    : `开始计时 - 开始专注计时${task.totalTimeSpent > 0 ? `（累计已用时 ${formatTimeSpent(task.totalTimeSpent)}）` : ""}`
              }
            >
              {isTimerLoading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
              ) : isTimerActive ? (
                <PauseIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}

              {/* 计时动画环 */}
              {isTimerActive && !isTimerLoading && (
                <div className="absolute inset-0 animate-ping rounded-full border-2 border-green-400 opacity-20"></div>
              )}
            </button>
          </div>
        )}

        {/* 第四行：当前计时状态（仅在计时时显示） */}
        {task.status === TaskStatus.IN_PROGRESS && isTimerActive && (
          <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-2 py-1.5">
            <div className="flex items-center text-xs text-green-700">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
              <span className="font-medium">正在计时</span>
            </div>
            <div className="font-mono text-xs font-semibold text-green-800">
              {formatTimeSpent(currentSessionTime)}
            </div>
          </div>
        )}

        {/* 任务反馈（仅在已完成且有反馈时显示） */}
        {task.status === TaskStatus.DONE && task.feedback && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5">
            <div className="flex items-start">
              <span className="mr-1 text-xs font-medium text-blue-600">💭</span>
              <p
                className="line-clamp-3 text-xs text-blue-700"
                title={task.feedback}
              >
                {task.feedback}
              </p>
            </div>
          </div>
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

export default KanbanPage;

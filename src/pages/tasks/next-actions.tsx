import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useMemo, useCallback } from "react";
import {
  PlusIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  BoltIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  HomeIcon,
  BuildingOfficeIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading } from "@/components/UI";
import TaskModal from "@/components/Tasks/TaskModal";
import { usePageRefresh } from "@/hooks/usePageRefresh";

// 上下文类型定义
interface ContextGroup {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  description: string;
  tasks: TaskWithRelations[];
}

// 扩展Task类型以包含关联数据
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

const NextActionsPage: NextPage = () => {
  const { data: sessionData } = useSession();

  // 状态管理
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  // 获取下一步行动任务（TODO和IN_PROGRESS状态）
  const { data: tasksData, isLoading, refetch, isFetching } = api.task.getAll.useQuery(
    {
      limit: 100,
      // 不设置status筛选，在客户端筛选下一步行动
    },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000, // 30秒缓存
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 任务操作相关的mutations
  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const startTimer = api.task.startTimer.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // 格式化时间显示
  const formatTimeSpent = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // 检查计时器是否激活
  const isTimerActive = useCallback((task: TaskWithRelations): boolean => {
    return task.isTimerActive && task.timeEntries.some(entry => !entry.endTime);
  }, []);

  // 处理任务编辑
  const handleEditTask = useCallback((taskId: string) => {
    setEditingTaskId(taskId);
    setIsTaskModalOpen(true);
  }, []);

  // 处理任务模态框关闭
  const handleTaskModalClose = useCallback(() => {
    setIsTaskModalOpen(false);
    setEditingTaskId(null);
  }, []);

  // 处理任务模态框成功
  const handleTaskModalSuccess = useCallback(() => {
    void refetch();
    handleTaskModalClose();
  }, [refetch, handleTaskModalClose]);

  // 快速标记完成
  const handleMarkDone = useCallback(async (taskId: string) => {
    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: TaskStatus.DONE,
        note: "从下一步行动快速完成",
      });
    } catch (error) {
      console.error("标记完成失败:", error);
    }
  }, [updateTaskStatus]);

  // 快速开始计时
  const handleStartTimer = useCallback(async (taskId: string) => {
    try {
      await startTimer.mutateAsync({
        id: taskId,
        description: "开始工作",
      });
    } catch (error) {
      console.error("开始计时失败:", error);
    }
  }, [startTimer]);

  // 延期任务
  const handleDefer = useCallback(async (taskId: string) => {
    // TODO: 实现延期功能，可以打开一个日期选择器
    console.log("延期任务:", taskId);
  }, []);

  // 委派任务
  const handleDelegate = useCallback(async (taskId: string) => {
    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: TaskStatus.WAITING,
        note: "任务已委派，等待他人处理",
      });
    } catch (error) {
      console.error("委派任务失败:", error);
    }
  }, [updateTaskStatus]);

  // 根据标签判断上下文
  const getTaskContext = useCallback((task: TaskWithRelations): string => {
    const contextTags = task.tags.map(t => t.tag.name.toLowerCase());
    
    if (contextTags.some(tag => tag.includes('电脑') || tag.includes('computer') || tag.includes('@电脑'))) {
      return 'computer';
    }
    if (contextTags.some(tag => tag.includes('电话') || tag.includes('phone') || tag.includes('@电话'))) {
      return 'phone';
    }
    if (contextTags.some(tag => tag.includes('外出') || tag.includes('errand') || tag.includes('@外出'))) {
      return 'errand';
    }
    if (contextTags.some(tag => tag.includes('家里') || tag.includes('home') || tag.includes('@家里'))) {
      return 'home';
    }
    if (contextTags.some(tag => tag.includes('办公室') || tag.includes('office') || tag.includes('@办公室'))) {
      return 'office';
    }
    
    // 默认上下文
    return 'general';
  }, []);

  // 按上下文分组任务
  const contextGroups = useMemo((): ContextGroup[] => {
    const tasks = tasksData?.tasks || [];
    
    // 筛选下一步行动（TODO和IN_PROGRESS状态）
    const nextActionTasks = tasks.filter(task => 
      task.status === TaskStatus.TODO || task.status === TaskStatus.IN_PROGRESS
    );

    // 定义上下文组
    const contexts: Omit<ContextGroup, 'tasks'>[] = [
      {
        id: 'computer',
        name: '@电脑',
        icon: ComputerDesktopIcon,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: '需要使用电脑完成的任务',
      },
      {
        id: 'phone',
        name: '@电话',
        icon: PhoneIcon,
        color: 'bg-green-100 text-green-800 border-green-200',
        description: '需要打电话或通话的任务',
      },
      {
        id: 'office',
        name: '@办公室',
        icon: BuildingOfficeIcon,
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: '需要在办公室完成的任务',
      },
      {
        id: 'home',
        name: '@家里',
        icon: HomeIcon,
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        description: '需要在家里完成的任务',
      },
      {
        id: 'errand',
        name: '@外出',
        icon: MapPinIcon,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        description: '需要外出办理的任务',
      },
      {
        id: 'general',
        name: '通用',
        icon: BoltIcon,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        description: '不限制特定上下文的任务',
      },
    ];

    // 按上下文分组任务
    return contexts.map(context => ({
      ...context,
      tasks: nextActionTasks.filter(task => getTaskContext(task) === context.id),
    }));
  }, [tasksData?.tasks, getTaskContext]);

  // 筛选后的上下文组（只显示有任务的组，或者选中的组）
  const filteredContextGroups = useMemo(() => {
    if (selectedContext) {
      return contextGroups.filter(group => group.id === selectedContext);
    }
    return contextGroups.filter(group => group.tasks.length > 0);
  }, [contextGroups, selectedContext]);

  // 统计信息
  const stats = useMemo(() => {
    const totalTasks = contextGroups.reduce((sum, group) => sum + group.tasks.length, 0);
    const urgentTasks = contextGroups.reduce((sum, group) => 
      sum + group.tasks.filter(task => task.priority === Priority.URGENT).length, 0
    );
    const overdueTasks = contextGroups.reduce((sum, group) => 
      sum + group.tasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < new Date()
      ).length, 0
    );

    return { totalTasks, urgentTasks, overdueTasks };
  }, [contextGroups]);

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>下一步行动 | Smart GTD</title>
          <meta name="description" content="GTD下一步行动列表" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和统计 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">下一步行动</h1>
              {isFetching && !isLoading && (
                <div className="flex items-center text-sm text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  刷新中...
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* 统计信息 */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <BoltIcon className="h-4 w-4" />
                  {stats.totalTasks} 个行动
                </span>
                {stats.urgentTasks > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <ClockIcon className="h-4 w-4" />
                    {stats.urgentTasks} 个紧急
                  </span>
                )}
                {stats.overdueTasks > 0 && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <CalendarIcon className="h-4 w-4" />
                    {stats.overdueTasks} 个逾期
                  </span>
                )}
              </div>

              {/* 新建任务按钮 */}
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新建行动
              </button>
            </div>
          </div>

          {/* 上下文筛选 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedContext(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedContext === null
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              全部上下文
            </button>
            {contextGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedContext(group.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedContext === group.id
                    ? group.color
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {group.name} ({group.tasks.length})
              </button>
            ))}
          </div>

          {/* 下一步行动列表 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载下一步行动中..."
            loadingComponent={<SectionLoading message="加载下一步行动中..." />}
          >
            {filteredContextGroups.length > 0 ? (
              <div className="space-y-6">
                {filteredContextGroups.map((group) => (
                  <ContextGroupCard
                    key={group.id}
                    group={group}
                    onEditTask={handleEditTask}
                    onMarkDone={handleMarkDone}
                    onStartTimer={handleStartTimer}
                    onDefer={handleDefer}
                    onDelegate={handleDelegate}
                    formatTimeSpent={formatTimeSpent}
                    isTimerActive={isTimerActive}
                    isUpdating={updateTaskStatus.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <BoltIcon className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无下一步行动</h3>
                <p className="mt-1 text-sm text-gray-500">
                  创建一些待办任务，它们会自动出现在这里
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    创建第一个行动
                  </button>
                </div>
              </div>
            )}
          </QueryLoading>
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

// 上下文组卡片组件
interface ContextGroupCardProps {
  group: ContextGroup;
  onEditTask: (taskId: string) => void;
  onMarkDone: (taskId: string) => void;
  onStartTimer: (taskId: string) => void;
  onDefer: (taskId: string) => void;
  onDelegate: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: (task: TaskWithRelations) => boolean;
  isUpdating: boolean;
}

function ContextGroupCard({
  group,
  onEditTask,
  onMarkDone,
  onStartTimer,
  onDefer,
  onDelegate,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
}: ContextGroupCardProps) {
  const Icon = group.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 组标题 */}
      <div className={`px-6 py-4 border-b border-gray-200 ${group.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <div>
              <h3 className="text-lg font-medium">{group.name}</h3>
              <p className="text-sm opacity-75">{group.description}</p>
            </div>
          </div>
          <span className="text-sm font-medium">
            {group.tasks.length} 个行动
          </span>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-gray-200">
        {group.tasks.map((task) => (
          <NextActionCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task.id)}
            onMarkDone={() => onMarkDone(task.id)}
            onStartTimer={() => onStartTimer(task.id)}
            onDefer={() => onDefer(task.id)}
            onDelegate={() => onDelegate(task.id)}
            formatTimeSpent={formatTimeSpent}
            isTimerActive={isTimerActive(task)}
            isUpdating={isUpdating}
          />
        ))}
      </div>
    </div>
  );
}

// 下一步行动卡片组件
interface NextActionCardProps {
  task: TaskWithRelations;
  onEdit: () => void;
  onMarkDone: () => void;
  onStartTimer: () => void;
  onDefer: () => void;
  onDelegate: () => void;
  formatTimeSpent: (seconds: number) => string;
  isTimerActive: boolean;
  isUpdating: boolean;
}

function NextActionCard({
  task,
  onEdit,
  onMarkDone,
  onStartTimer,
  onDefer,
  onDelegate,
  formatTimeSpent,
  isTimerActive,
  isUpdating,
}: NextActionCardProps) {
  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  const statusColors = {
    TODO: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  };

  // 判断是否逾期
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        {/* 任务信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            {/* 完成按钮 */}
            <button
              onClick={onMarkDone}
              disabled={isUpdating}
              className="mt-1 p-1 rounded-full hover:bg-green-100 text-gray-400 hover:text-green-600 disabled:opacity-50"
              title="标记完成"
            >
              <CheckIcon className="h-5 w-5" />
            </button>

            {/* 任务内容 */}
            <div className="flex-1 min-w-0">
              <h4
                className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 line-clamp-2"
                onClick={onEdit}
              >
                {task.title}
              </h4>

              {task.description && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* 标签和项目 */}
              <div className="flex flex-wrap gap-1 mt-2">
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

                {task.tags.slice(0, 3).map((tagRelation) => (
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

                {task.tags.length > 3 && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    +{task.tags.length - 3}
                  </span>
                )}
              </div>

              {/* 底部信息 */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {/* 状态 */}
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[task.status as keyof typeof statusColors]}`}>
                  {task.status === TaskStatus.TODO ? "待办" : "进行中"}
                </span>

                {/* 优先级 */}
                {task.priority && (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                )}

                {/* 截止日期 */}
                {task.dueDate && (
                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                    <CalendarIcon className="h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                    {task.dueTime && ` ${task.dueTime}`}
                    {isOverdue && " (逾期)"}
                  </span>
                )}

                {/* 时间统计 */}
                {task.totalTimeSpent > 0 && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    {formatTimeSpent(task.totalTimeSpent)}
                  </span>
                )}

                {/* 计时器状态 */}
                {isTimerActive && (
                  <span className="flex items-center gap-1 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    计时中
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快速操作按钮 */}
        <div className="flex items-center gap-1 ml-4">
          {/* 开始计时 */}
          {task.status === TaskStatus.IN_PROGRESS && !isTimerActive && (
            <button
              onClick={onStartTimer}
              disabled={isUpdating}
              className="p-2 rounded-md hover:bg-green-100 text-gray-400 hover:text-green-600 disabled:opacity-50"
              title="开始计时"
            >
              <ClockIcon className="h-4 w-4" />
            </button>
          )}

          {/* 延期 */}
          <button
            onClick={onDefer}
            disabled={isUpdating}
            className="p-2 rounded-md hover:bg-yellow-100 text-gray-400 hover:text-yellow-600 disabled:opacity-50"
            title="延期"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>

          {/* 委派 */}
          <button
            onClick={onDelegate}
            disabled={isUpdating}
            className="p-2 rounded-md hover:bg-purple-100 text-gray-400 hover:text-purple-600 disabled:opacity-50"
            title="委派给他人"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NextActionsPage;

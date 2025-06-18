import { type NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useMemo, useCallback } from "react";
import {
  PlusIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowPathIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { QueryLoading, SectionLoading } from "@/components/UI";
import TaskModal from "@/components/Tasks/TaskModal";
import { usePageRefresh } from "@/hooks/usePageRefresh";

// 等待类型定义
interface WaitingGroup {
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

const WaitingPage: NextPage = () => {
  const { data: sessionData } = useSession();

  // 状态管理
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedWaitingType, setSelectedWaitingType] = useState<string | null>(null);

  // 获取等待中的任务
  const { data: tasksData, isLoading, refetch, isFetching } = api.task.getAll.useQuery(
    {
      limit: 100,
      status: TaskStatus.WAITING,
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

  // 格式化时间显示
  const formatTimeSpent = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  // 恢复为下一步行动
  const handleResumeAction = useCallback(async (taskId: string) => {
    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: TaskStatus.TODO,
        note: "从等待清单恢复为下一步行动",
      });
    } catch (error) {
      console.error("恢复行动失败:", error);
    }
  }, [updateTaskStatus]);

  // 标记完成
  const handleMarkDone = useCallback(async (taskId: string) => {
    try {
      await updateTaskStatus.mutateAsync({
        id: taskId,
        status: TaskStatus.DONE,
        note: "等待事项已完成",
      });
    } catch (error) {
      console.error("标记完成失败:", error);
    }
  }, [updateTaskStatus]);

  // 跟进提醒
  const handleFollowUp = useCallback(async (taskId: string) => {
    // TODO: 实现跟进提醒功能，可以发送通知或创建提醒任务
    console.log("跟进提醒:", taskId);
  }, []);

  // 根据标签判断等待类型
  const getWaitingType = useCallback((task: TaskWithRelations): string => {
    const waitingTags = task.tags.map(t => t.tag.name.toLowerCase());
    
    if (waitingTags.some(tag => tag.includes('回复') || tag.includes('邮件') || tag.includes('email'))) {
      return 'email';
    }
    if (waitingTags.some(tag => tag.includes('电话') || tag.includes('通话') || tag.includes('phone'))) {
      return 'phone';
    }
    if (waitingTags.some(tag => tag.includes('会议') || tag.includes('讨论') || tag.includes('meeting'))) {
      return 'meeting';
    }
    if (waitingTags.some(tag => tag.includes('审批') || tag.includes('批准') || tag.includes('approval'))) {
      return 'approval';
    }
    if (waitingTags.some(tag => tag.includes('他人') || tag.includes('委派') || tag.includes('delegate'))) {
      return 'delegate';
    }
    
    // 默认等待类型
    return 'general';
  }, []);

  // 按等待类型分组任务
  const waitingGroups = useMemo((): WaitingGroup[] => {
    const tasks = tasksData?.tasks || [];

    // 定义等待类型组
    const waitingTypes: Omit<WaitingGroup, 'tasks'>[] = [
      {
        id: 'email',
        name: '等待回复',
        icon: EnvelopeIcon,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: '等待邮件回复或信息反馈',
      },
      {
        id: 'phone',
        name: '等待通话',
        icon: PhoneIcon,
        color: 'bg-green-100 text-green-800 border-green-200',
        description: '等待电话回复或通话安排',
      },
      {
        id: 'meeting',
        name: '等待会议',
        icon: ChatBubbleLeftRightIcon,
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: '等待会议安排或讨论结果',
      },
      {
        id: 'approval',
        name: '等待审批',
        icon: ExclamationTriangleIcon,
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        description: '等待上级审批或决策',
      },
      {
        id: 'delegate',
        name: '委派他人',
        icon: UserIcon,
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: '委派给他人处理的任务',
      },
      {
        id: 'general',
        name: '其他等待',
        icon: ClockIcon,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        description: '其他类型的等待事项',
      },
    ];

    // 按等待类型分组任务
    return waitingTypes.map(waitingType => ({
      ...waitingType,
      tasks: tasks.filter(task => getWaitingType(task) === waitingType.id),
    }));
  }, [tasksData?.tasks, getWaitingType]);

  // 筛选后的等待组（只显示有任务的组，或者选中的组）
  const filteredWaitingGroups = useMemo(() => {
    if (selectedWaitingType) {
      return waitingGroups.filter(group => group.id === selectedWaitingType);
    }
    return waitingGroups.filter(group => group.tasks.length > 0);
  }, [waitingGroups, selectedWaitingType]);

  // 统计信息
  const stats = useMemo(() => {
    const totalTasks = waitingGroups.reduce((sum, group) => sum + group.tasks.length, 0);
    const urgentTasks = waitingGroups.reduce((sum, group) => 
      sum + group.tasks.filter(task => task.priority === Priority.URGENT).length, 0
    );
    const overdueTasks = waitingGroups.reduce((sum, group) => 
      sum + group.tasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < new Date()
      ).length, 0
    );
    const longWaitingTasks = waitingGroups.reduce((sum, group) => 
      sum + group.tasks.filter(task => {
        const daysSinceCreated = Math.floor(
          (new Date().getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceCreated >= 7; // 等待超过7天
      }).length, 0
    );

    return { totalTasks, urgentTasks, overdueTasks, longWaitingTasks };
  }, [waitingGroups]);

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>等待清单 | Smart GTD</title>
          <meta name="description" content="GTD等待清单管理" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题和统计 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">等待清单</h1>
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
                  <ClockIcon className="h-4 w-4" />
                  {stats.totalTasks} 个等待
                </span>
                {stats.urgentTasks > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {stats.urgentTasks} 个紧急
                  </span>
                )}
                {stats.overdueTasks > 0 && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <CalendarIcon className="h-4 w-4" />
                    {stats.overdueTasks} 个逾期
                  </span>
                )}
                {stats.longWaitingTasks > 0 && (
                  <span className="flex items-center gap-1 text-purple-600">
                    <ArrowPathIcon className="h-4 w-4" />
                    {stats.longWaitingTasks} 个长期等待
                  </span>
                )}
              </div>

              {/* 新建任务按钮 */}
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                新建等待
              </button>
            </div>
          </div>

          {/* 等待类型筛选 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedWaitingType(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedWaitingType === null
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              全部等待
            </button>
            {waitingGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedWaitingType(group.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedWaitingType === group.id
                    ? group.color
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {group.name} ({group.tasks.length})
              </button>
            ))}
          </div>

          {/* 等待清单 */}
          <QueryLoading
            isLoading={isLoading}
            error={null}
            loadingMessage="加载等待清单中..."
            loadingComponent={<SectionLoading message="加载等待清单中..." />}
          >
            {filteredWaitingGroups.length > 0 ? (
              <div className="space-y-6">
                {filteredWaitingGroups.map((group) => (
                  <WaitingGroupCard
                    key={group.id}
                    group={group}
                    onEditTask={handleEditTask}
                    onMarkDone={handleMarkDone}
                    onResumeAction={handleResumeAction}
                    onFollowUp={handleFollowUp}
                    formatTimeSpent={formatTimeSpent}
                    isUpdating={updateTaskStatus.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <ClockIcon className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无等待事项</h3>
                <p className="mt-1 text-sm text-gray-500">
                  当您委派任务给他人或等待他人回复时，这些任务会出现在这里
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    创建等待事项
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

// 等待组卡片组件
interface WaitingGroupCardProps {
  group: WaitingGroup;
  onEditTask: (taskId: string) => void;
  onMarkDone: (taskId: string) => void;
  onResumeAction: (taskId: string) => void;
  onFollowUp: (taskId: string) => void;
  formatTimeSpent: (seconds: number) => string;
  isUpdating: boolean;
}

function WaitingGroupCard({
  group,
  onEditTask,
  onMarkDone,
  onResumeAction,
  onFollowUp,
  formatTimeSpent,
  isUpdating,
}: WaitingGroupCardProps) {
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
            {group.tasks.length} 个等待
          </span>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-gray-200">
        {group.tasks.map((task) => (
          <WaitingTaskCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task.id)}
            onMarkDone={() => onMarkDone(task.id)}
            onResumeAction={() => onResumeAction(task.id)}
            onFollowUp={() => onFollowUp(task.id)}
            formatTimeSpent={formatTimeSpent}
            isUpdating={isUpdating}
          />
        ))}
      </div>
    </div>
  );
}

// 等待任务卡片组件
interface WaitingTaskCardProps {
  task: TaskWithRelations;
  onEdit: () => void;
  onMarkDone: () => void;
  onResumeAction: () => void;
  onFollowUp: () => void;
  formatTimeSpent: (seconds: number) => string;
  isUpdating: boolean;
}

function WaitingTaskCard({
  task,
  onEdit,
  onMarkDone,
  onResumeAction,
  onFollowUp,
  formatTimeSpent,
  isUpdating,
}: WaitingTaskCardProps) {
  const priorityColors = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  // 判断是否逾期
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  // 计算等待天数
  const waitingDays = Math.floor(
    (new Date().getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 判断是否长期等待
  const isLongWaiting = waitingDays >= 7;

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
              <div className="flex items-start justify-between mb-2">
                <h4
                  className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 line-clamp-2"
                  onClick={onEdit}
                >
                  {task.title}
                </h4>

                {/* 等待时间提醒 */}
                <div className="flex items-center gap-2 ml-4">
                  {isLongWaiting && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      等待 {waitingDays} 天
                    </span>
                  )}
                  {isOverdue && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      已逾期
                    </span>
                  )}
                </div>
              </div>

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
                  </span>
                )}

                {/* 等待时间 */}
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  等待 {waitingDays} 天
                </span>

                {/* 时间统计 */}
                {task.totalTimeSpent > 0 && (
                  <span className="flex items-center gap-1">
                    ⏱️ {formatTimeSpent(task.totalTimeSpent)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 快速操作按钮 */}
        <div className="flex items-center gap-1 ml-4">
          {/* 跟进提醒 */}
          <button
            onClick={onFollowUp}
            disabled={isUpdating}
            className="p-2 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 disabled:opacity-50"
            title="跟进提醒"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>

          {/* 恢复行动 */}
          <button
            onClick={onResumeAction}
            disabled={isUpdating}
            className="p-2 rounded-md hover:bg-green-100 text-gray-400 hover:text-green-600 disabled:opacity-50"
            title="恢复为下一步行动"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaitingPage;

import { z } from "zod";
import { Priority, TaskStatus, TaskType } from "@prisma/client";

// 基础任务创建 Schema
export const createTaskSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(200, "任务标题过长"),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).default(TaskType.NORMAL),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.IDEA),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.date().optional(),
  dueTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "时间格式无效")
    .optional(),
  projectId: z.string().cuid("无效的项目ID").optional(),
  tagIds: z.array(z.string().cuid("无效的标签ID")).optional(),
});

// 任务更新 Schema
export const updateTaskSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  title: z
    .string()
    .min(1, "任务标题不能为空")
    .max(200, "任务标题过长")
    .optional(),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z.date().optional(),
  dueTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "时间格式无效")
    .optional(),
  projectId: z.string().cuid("无效的项目ID").optional(),
  tagIds: z.array(z.string().cuid("无效的标签ID")).optional(),
  // 反馈和等待原因相关字段
  feedback: z.string().max(1000, "反馈内容过长").optional(),
  waitingReason: z.string().max(1000, "等待原因过长").optional(),
});

// 任务状态更新 Schema
export const updateTaskStatusSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  status: z.nativeEnum(TaskStatus),
  note: z.string().max(500, "备注过长").optional(),
});

// 任务查询 Schema
export const getTasksSchema = z.object({
  projectId: z.string().cuid("无效的项目ID").optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(TaskType).optional(),
  tagIds: z.array(z.string().cuid("无效的标签ID")).optional(), // 标签筛选
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  // 日期筛选
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  updatedAfter: z.date().optional(),
  updatedBefore: z.date().optional(),
  completedAfter: z.date().optional(),
  completedBefore: z.date().optional(),
  dueAfter: z.date().optional(),
  dueBefore: z.date().optional(),
});

// 任务ID Schema
export const taskIdSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
});

// 重复任务设置 Schema
export const setRecurringSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  isRecurring: z.boolean(),
  recurringPattern: z
    .object({
      type: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
      interval: z.number().min(1).max(365),
      time: z
        .string()
        .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
      dayOfMonth: z.number().min(1).max(31).optional(),
    })
    .optional(),
});

// 时间追踪 Schema
export const timeTrackingSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  description: z.string().max(200, "描述过长").optional(),
});

// 时间记录查询 Schema
export const getTimeEntriesSchema = z.object({
  taskId: z.string().cuid("无效的任务ID").optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
});

// 任务统计查询 Schema
export const getTaskStatsSchema = z.object({
  projectId: z.string().cuid("无效的项目ID").optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// 获取每日活动数据 Schema
export const getDailyActivitySchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// 批量操作 Schema
export const batchUpdateTasksSchema = z.object({
  taskIds: z.array(z.string().cuid("无效的任务ID")).min(1, "至少选择一个任务"),
  updates: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    projectId: z.string().cuid("无效的项目ID").optional(),
    tagIds: z.array(z.string().cuid("无效的标签ID")).optional(),
  }),
});

// 批量删除 Schema
export const batchDeleteTasksSchema = z.object({
  taskIds: z.array(z.string().cuid("无效的任务ID")).min(1, "至少选择一个任务"),
});

// 任务位置更新 Schema（邻接插入 + 稀疏排序）
export const updateTaskPositionSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  toStatus: z.nativeEnum(TaskStatus).optional(),
  beforeId: z.string().cuid("无效的任务ID").optional(),
  afterId: z.string().cuid("无效的任务ID").optional(),
  note: z.string().max(500, "备注过长").optional(),
});

// 任务反馈 Schema
export const updateTaskFeedbackSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  feedback: z.string().max(1000, "反馈内容过长").optional(),
});

// 任务延期 Schema
export const postponeTaskSchema = z.object({
  id: z.string().cuid("无效的任务ID"),
  dueDate: z.date(),
  dueTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "时间格式无效")
    .optional(),
  note: z.string().max(500, "备注过长").optional(),
});

// 按状态获取任务 Schema
export const getTasksByStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus, { required_error: "状态不能为空" }),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

// 导出类型
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type GetTasksInput = z.infer<typeof getTasksSchema>;
export type TaskIdInput = z.infer<typeof taskIdSchema>;
export type SetRecurringInput = z.infer<typeof setRecurringSchema>;
export type TimeTrackingInput = z.infer<typeof timeTrackingSchema>;
export type GetTimeEntriesInput = z.infer<typeof getTimeEntriesSchema>;
export type UpdateTaskPositionInput = z.infer<typeof updateTaskPositionSchema>;

export type GetTaskStatsInput = z.infer<typeof getTaskStatsSchema>;
export type GetDailyActivityInput = z.infer<typeof getDailyActivitySchema>;
export type BatchUpdateTasksInput = z.infer<typeof batchUpdateTasksSchema>;
export type BatchDeleteTasksInput = z.infer<typeof batchDeleteTasksSchema>;
export type UpdateTaskFeedbackInput = z.infer<typeof updateTaskFeedbackSchema>;

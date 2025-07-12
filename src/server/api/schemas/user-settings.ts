import { z } from "zod";

// 用户设置 Schema
export const userSettingsSchema = z.object({
  // 日记自动生成设置
  autoJournalGeneration: z.object({
    enabled: z.boolean().default(true),
    onTaskComplete: z.boolean().default(true), // 任务完成时自动更新日记
    dailySchedule: z.boolean().default(true),  // 每日定时生成
    scheduleTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default("23:55"), // 定时生成时间
    templateName: z.string().default("默认模板"), // 使用的模板
    includeTimeSpent: z.boolean().default(true), // 是否包含用时信息
    includeTags: z.boolean().default(true), // 是否包含标签
    includeProject: z.boolean().default(true), // 是否包含项目信息
  }).optional(),

  // 通知设置
  notifications: z.object({
    journalReminder: z.boolean().default(false), // 日记提醒
    reminderTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default("21:00"), // 提醒时间
    taskDeadlineReminder: z.boolean().default(true), // 任务截止提醒
    weeklyReview: z.boolean().default(false), // 周回顾提醒
  }).optional(),

  // 界面设置
  ui: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    language: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
    dateFormat: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]).default("YYYY-MM-DD"),
    timeFormat: z.enum(["24h", "12h"]).default("24h"),
  }).optional(),
});

// 更新用户设置 Schema
export const updateUserSettingsSchema = z.object({
  settings: userSettingsSchema,
});

// 获取用户设置 Schema（用于查询参数）
export const getUserSettingsSchema = z.object({
  category: z.enum(["autoJournalGeneration", "notifications", "ui"]).optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type AutoJournalSettings = NonNullable<UserSettings["autoJournalGeneration"]>;
export type NotificationSettings = NonNullable<UserSettings["notifications"]>;
export type UISettings = NonNullable<UserSettings["ui"]>;

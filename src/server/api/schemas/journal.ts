import { z } from "zod";

// 日志创建 Schema
export const createJournalSchema = z.object({
  date: z.date(),
  content: z.string().min(1, "日志内容不能为空"),
  template: z.string().max(100, "模板名称过长").optional(),
});

// 日志更新 Schema
export const updateJournalSchema = z.object({
  id: z.string().cuid("无效的日志ID"),
  content: z.string().min(1, "日志内容不能为空").optional(),
  template: z.string().max(100, "模板名称过长").optional(),
});

// 按日期获取日志 Schema
export const getJournalByDateSchema = z.object({
  date: z.date(),
});

// 日志查询 Schema
export const getJournalsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(100).default(30),
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  template: z.string().max(100).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// 日志ID Schema
export const journalIdSchema = z.object({
  id: z.string().cuid("无效的日志ID"),
});

// 日志模板 Schema
export const journalTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(100, "模板名称过长"),
  content: z.string().min(1, "模板内容不能为空"),
  description: z.string().max(500, "模板描述过长").optional(),
  variables: z.array(z.string()).optional(), // 模板变量列表
});

// 从模板创建日志 Schema
export const createJournalFromTemplateSchema = z.object({
  date: z.date(),
  templateName: z.string().min(1, "模板名称不能为空"),
  variables: z.record(z.string()).optional(), // 变量替换
});

// 日志统计查询 Schema
export const getJournalStatsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  groupBy: z.enum(["day", "week", "month", "year"]).default("month"),
});

// 日志搜索 Schema
export const searchJournalsSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空").max(100, "搜索关键词过长"),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().cuid().optional(),
});

// 日志导出 Schema
export const exportJournalsSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  format: z.enum(["markdown", "html", "json", "pdf"]).default("markdown"),
  includeMetadata: z.boolean().default(true),
  template: z.string().max(100).optional(),
});

// 批量日志操作 Schema
export const batchJournalOperationSchema = z.object({
  journalIds: z.array(z.string().cuid("无效的日志ID")).min(1, "至少选择一个日志"),
  operation: z.enum(["delete", "export", "template"]),
  templateName: z.string().max(100).optional(), // 用于应用模板操作
});

// 日志时间线查询 Schema
export const getJournalTimelineSchema = z.object({
  year: z.number().min(2020).max(2030),
  month: z.number().min(1).max(12).optional(),
});

// 日志备份 Schema
export const backupJournalsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  includeTemplates: z.boolean().default(true),
  format: z.enum(["json", "zip"]).default("json"),
});

// 日志恢复 Schema
export const restoreJournalsSchema = z.object({
  backupData: z.string(), // JSON 格式的备份数据
  overwriteExisting: z.boolean().default(false),
});

// 日志提醒设置 Schema
export const journalReminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "时间格式无效").optional(),
  days: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
  template: z.string().max(100).optional(),
});

// 导出类型
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type GetJournalByDateInput = z.infer<typeof getJournalByDateSchema>;
export type GetJournalsInput = z.infer<typeof getJournalsSchema>;
export type JournalIdInput = z.infer<typeof journalIdSchema>;
export type JournalTemplateInput = z.infer<typeof journalTemplateSchema>;
export type CreateJournalFromTemplateInput = z.infer<typeof createJournalFromTemplateSchema>;
export type GetJournalStatsInput = z.infer<typeof getJournalStatsSchema>;
export type SearchJournalsInput = z.infer<typeof searchJournalsSchema>;
export type ExportJournalsInput = z.infer<typeof exportJournalsSchema>;
export type BatchJournalOperationInput = z.infer<typeof batchJournalOperationSchema>;
export type GetJournalTimelineInput = z.infer<typeof getJournalTimelineSchema>;
export type BackupJournalsInput = z.infer<typeof backupJournalsSchema>;
export type RestoreJournalsInput = z.infer<typeof restoreJournalsSchema>;
export type JournalReminderInput = z.infer<typeof journalReminderSchema>;

import { z } from "zod";

// 笔记创建 Schema
export const createNoteSchema = z.object({
  title: z.string().min(1, "笔记标题不能为空").max(200, "笔记标题过长"),
  content: z.string().min(1, "笔记内容不能为空"),
  projectId: z.string().cuid("无效的项目ID").optional(),
  tagIds: z.array(z.string().cuid("无效的标签ID")).optional(),
  linkedTaskIds: z.array(z.string().cuid("无效的任务ID")).optional(),
});

// 笔记更新 Schema
export const updateNoteSchema = z.object({
  id: z.string().cuid("无效的笔记ID"),
  title: z.string().min(1, "笔记标题不能为空").max(200, "笔记标题过长").optional(),
  content: z.string().min(1, "笔记内容不能为空").optional(),
  projectId: z.string().cuid("无效的项目ID").optional(),
  tagIds: z.array(z.string().cuid("无效的标签ID")).optional(),
  linkedTaskIds: z.array(z.string().cuid("无效的任务ID")).optional(),
});

// 笔记查询 Schema
export const getNotesSchema = z.object({
  projectId: z.string().cuid("无效的项目ID").optional(),
  tagId: z.string().cuid("无效的标签ID").optional(),
  includeArchived: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// 笔记ID Schema
export const noteIdSchema = z.object({
  id: z.string().cuid("无效的笔记ID"),
});

// 笔记归档 Schema
export const archiveNoteSchema = z.object({
  id: z.string().cuid("无效的笔记ID"),
  isArchived: z.boolean(),
});

// 笔记任务关联 Schema
export const linkNoteToTaskSchema = z.object({
  noteId: z.string().cuid("无效的笔记ID"),
  taskId: z.string().cuid("无效的任务ID"),
});

// 取消笔记任务关联 Schema
export const unlinkNoteFromTaskSchema = z.object({
  noteId: z.string().cuid("无效的笔记ID"),
  taskId: z.string().cuid("无效的任务ID"),
});

// 批量笔记操作 Schema
export const batchNoteOperationSchema = z.object({
  noteIds: z.array(z.string().cuid("无效的笔记ID")).min(1, "至少选择一个笔记"),
  operation: z.enum(["archive", "unarchive", "delete", "move"]),
  targetProjectId: z.string().cuid("无效的项目ID").optional(), // 用于移动操作
});

// 笔记搜索 Schema
export const searchNotesSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空").max(100, "搜索关键词过长"),
  projectId: z.string().cuid("无效的项目ID").optional(),
  includeArchived: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

// 笔记导出 Schema
export const exportNotesSchema = z.object({
  noteIds: z.array(z.string().cuid("无效的笔记ID")).optional(),
  projectId: z.string().cuid("无效的项目ID").optional(),
  format: z.enum(["markdown", "html", "json"]).default("markdown"),
  includeMetadata: z.boolean().default(true),
});

// 笔记统计 Schema
export const getNoteStatsSchema = z.object({
  projectId: z.string().cuid("无效的项目ID").optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// 笔记模板 Schema
export const createNoteFromTemplateSchema = z.object({
  templateId: z.string().cuid("无效的模板ID"),
  title: z.string().min(1, "笔记标题不能为空").max(200, "笔记标题过长"),
  projectId: z.string().cuid("无效的项目ID").optional(),
  variables: z.record(z.string()).optional(), // 模板变量替换
});

// 笔记版本 Schema
export const getNoteVersionsSchema = z.object({
  id: z.string().cuid("无效的笔记ID"),
  limit: z.number().min(1).max(50).default(10),
});

// 导出类型
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type GetNotesInput = z.infer<typeof getNotesSchema>;
export type NoteIdInput = z.infer<typeof noteIdSchema>;
export type ArchiveNoteInput = z.infer<typeof archiveNoteSchema>;
export type LinkNoteToTaskInput = z.infer<typeof linkNoteToTaskSchema>;
export type UnlinkNoteFromTaskInput = z.infer<typeof unlinkNoteFromTaskSchema>;
export type BatchNoteOperationInput = z.infer<typeof batchNoteOperationSchema>;
export type SearchNotesInput = z.infer<typeof searchNotesSchema>;
export type ExportNotesInput = z.infer<typeof exportNotesSchema>;
export type GetNoteStatsInput = z.infer<typeof getNoteStatsSchema>;
export type CreateNoteFromTemplateInput = z.infer<typeof createNoteFromTemplateSchema>;
export type GetNoteVersionsInput = z.infer<typeof getNoteVersionsSchema>;

import { z } from "zod";

// 项目创建 Schema
export const createProjectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100, "项目名称过长"),
  description: z.string().max(500, "项目描述过长").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效").optional(),
});

// 项目更新 Schema
export const updateProjectSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
  name: z.string().min(1, "项目名称不能为空").max(100, "项目名称过长").optional(),
  description: z.string().max(500, "项目描述过长").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效").optional(),
});

// 项目查询 Schema
export const getProjectsSchema = z.object({
  includeArchived: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
});

// 项目ID Schema
export const projectIdSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
});

// 项目归档 Schema
export const archiveProjectSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
  isArchived: z.boolean(),
});

// 项目统计查询 Schema
export const getProjectStatsSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// 项目任务查询 Schema
export const getProjectTasksSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
  status: z.enum(["IDEA", "TODO", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
});

// 项目笔记查询 Schema
export const getProjectNotesSchema = z.object({
  id: z.string().cuid("无效的项目ID"),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
});

// 批量项目操作 Schema
export const batchProjectOperationSchema = z.object({
  projectIds: z.array(z.string().cuid("无效的项目ID")).min(1, "至少选择一个项目"),
  operation: z.enum(["archive", "unarchive", "delete"]),
});

// 项目排序 Schema
export const reorderProjectsSchema = z.object({
  projectIds: z.array(z.string().cuid("无效的项目ID")),
});

// 导出类型
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type GetProjectsInput = z.infer<typeof getProjectsSchema>;
export type ProjectIdInput = z.infer<typeof projectIdSchema>;
export type ArchiveProjectInput = z.infer<typeof archiveProjectSchema>;
export type GetProjectStatsInput = z.infer<typeof getProjectStatsSchema>;
export type GetProjectTasksInput = z.infer<typeof getProjectTasksSchema>;
export type GetProjectNotesInput = z.infer<typeof getProjectNotesSchema>;
export type BatchProjectOperationInput = z.infer<typeof batchProjectOperationSchema>;
export type ReorderProjectsInput = z.infer<typeof reorderProjectsSchema>;

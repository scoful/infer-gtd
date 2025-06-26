import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Priority, TagType, TaskStatus, TaskType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// 高级搜索 Schema
const advancedSearchSchema = z.object({
  // 基础搜索
  query: z.string().optional(),

  // 内容类型
  searchIn: z
    .array(z.enum(["tasks", "notes", "projects", "journals"]))
    .default(["tasks"]),

  // 任务特定筛选
  taskStatus: z.array(z.nativeEnum(TaskStatus)).optional(),
  taskType: z.array(z.nativeEnum(TaskType)).optional(),
  priority: z.array(z.nativeEnum(Priority)).optional(),

  // 标签筛选
  tagIds: z.array(z.string().cuid()).optional(),
  tagTypes: z.array(z.nativeEnum(TagType)).optional(),

  // 项目筛选
  projectIds: z.array(z.string().cuid()).optional(),

  // 日期筛选
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  updatedAfter: z.date().optional(),
  updatedBefore: z.date().optional(),
  dueAfter: z.date().optional(),
  dueBefore: z.date().optional(),

  // 时间筛选
  hasTimeTracking: z.boolean().optional(),
  minTimeSpent: z.number().min(0).optional(), // 秒
  maxTimeSpent: z.number().min(0).optional(), // 秒

  // 状态筛选
  isCompleted: z.boolean().optional(),
  isOverdue: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  hasDescription: z.boolean().optional(),

  // 排序
  sortBy: z
    .enum([
      "relevance",
      "createdAt",
      "updatedAt",
      "dueDate",
      "priority",
      "title",
      "timeSpent",
    ])
    .default("relevance"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),

  // 分页
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

// 保存的搜索 Schema
const savedSearchSchema = z.object({
  name: z.string().min(1, "搜索名称不能为空").max(100, "搜索名称过长"),
  description: z.string().max(500, "描述过长").optional(),
  searchParams: advancedSearchSchema,
  isPublic: z.boolean().default(false),
});

const searchIdSchema = z.object({
  id: z.string().cuid("无效的搜索ID"),
});

// 搜索建议 Schema
const searchSuggestionsSchema = z.object({
  query: z.string().min(1, "查询不能为空"),
  type: z.enum(["all", "tasks", "tags", "projects"]).default("all"),
  limit: z.number().min(1).max(20).default(10),
});

export const searchRouter = createTRPCRouter({
  // 高级搜索
  advanced: protectedProcedure
    .input(advancedSearchSchema)
    .query(async ({ ctx, input }) => {
      const {
        query,
        searchIn,
        limit,
        cursor,
        sortBy,
        sortOrder,
        taskStatus,
        taskType,
        priority,
        tagIds,
        tagTypes,
        projectIds,
        createdAfter,
        createdBefore,
        updatedAfter,
        updatedBefore,
        dueAfter,
        dueBefore,
        hasTimeTracking,
        minTimeSpent,
        maxTimeSpent,
        isCompleted,
        isOverdue,
        isRecurring,
        hasDescription,
      } = input;

      try {
        const results: any = {
          tasks: [],
          notes: [],
          projects: [],
          journals: [],
          totalCount: 0,
          nextCursor: undefined,
        };

        // 搜索任务
        if (searchIn.includes("tasks")) {
          const taskWhere: any = {
            createdById: ctx.session.user.id,
            ...(query && {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                {
                  description: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }),
            ...(taskStatus && { status: { in: taskStatus } }),
            ...(taskType && { type: { in: taskType } }),
            ...(priority && { priority: { in: priority } }),
            ...(projectIds && { projectId: { in: projectIds } }),
            ...(createdAfter && { createdAt: { gte: createdAfter } }),
            ...(createdBefore && { createdAt: { lte: createdBefore } }),
            ...(updatedAfter && { updatedAt: { gte: updatedAfter } }),
            ...(updatedBefore && { updatedAt: { lte: updatedBefore } }),
            ...(dueAfter && { dueDate: { gte: dueAfter } }),
            ...(dueBefore && { dueDate: { lte: dueBefore } }),
            ...(isCompleted !== undefined && {
              status: isCompleted ? TaskStatus.DONE : { not: TaskStatus.DONE },
            }),
            ...(isOverdue && {
              dueDate: { lt: new Date() },
              status: { not: TaskStatus.DONE },
            }),
            ...(isRecurring !== undefined && { isRecurring }),
            ...(hasDescription !== undefined && {
              description: hasDescription ? { not: null } : null,
            }),
            ...(tagIds && {
              tags: {
                some: {
                  tagId: { in: tagIds },
                },
              },
            }),
            ...(tagTypes && {
              tags: {
                some: {
                  tag: {
                    type: { in: tagTypes },
                  },
                },
              },
            }),
          };

          // 时间筛选需要聚合查询
          if (
            hasTimeTracking !== undefined ||
            minTimeSpent !== undefined ||
            maxTimeSpent !== undefined
          ) {
            // 这里需要更复杂的查询，暂时简化处理
            if (hasTimeTracking !== undefined) {
              taskWhere.totalTimeSpent = hasTimeTracking ? { gt: 0 } : 0;
            }
            if (minTimeSpent !== undefined) {
              taskWhere.totalTimeSpent = {
                ...taskWhere.totalTimeSpent,
                gte: minTimeSpent,
              };
            }
            if (maxTimeSpent !== undefined) {
              taskWhere.totalTimeSpent = {
                ...taskWhere.totalTimeSpent,
                lte: maxTimeSpent,
              };
            }
          }

          const tasks = await ctx.db.task.findMany({
            where: taskWhere,
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: getTaskOrderBy(sortBy, sortOrder),
            include: {
              project: true,
              tags: {
                include: {
                  tag: true,
                },
              },
              timeEntries: {
                where: { endTime: null },
                take: 1,
              },
              _count: {
                select: {
                  timeEntries: true,
                  statusHistory: true,
                },
              },
            },
          });

          if (tasks.length > limit) {
            const nextItem = tasks.pop();
            results.nextCursor = nextItem!.id;
          }

          results.tasks = tasks;
          results.totalCount += tasks.length;
        }

        // 搜索笔记
        if (searchIn.includes("notes")) {
          const noteWhere: any = {
            createdById: ctx.session.user.id,
            ...(query && {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { content: { contains: query, mode: "insensitive" as const } },
              ],
            }),
            ...(projectIds && { projectId: { in: projectIds } }),
            ...(createdAfter && { createdAt: { gte: createdAfter } }),
            ...(createdBefore && { createdAt: { lte: createdBefore } }),
            ...(updatedAfter && { updatedAt: { gte: updatedAfter } }),
            ...(updatedBefore && { updatedAt: { lte: updatedBefore } }),
            ...(tagIds && {
              tags: {
                some: {
                  tagId: { in: tagIds },
                },
              },
            }),
          };

          const notes = await ctx.db.note.findMany({
            where: noteWhere,
            take: limit,
            orderBy: getNoteOrderBy(sortBy, sortOrder),
            include: {
              project: true,
              tags: {
                include: {
                  tag: true,
                },
              },
              linkedTasks: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          });

          results.notes = notes;
          results.totalCount += notes.length;
        }

        // 搜索项目
        if (searchIn.includes("projects")) {
          const projectWhere: any = {
            createdById: ctx.session.user.id,
            ...(query && {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                {
                  description: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }),
            ...(createdAfter && { createdAt: { gte: createdAfter } }),
            ...(createdBefore && { createdAt: { lte: createdBefore } }),
            ...(updatedAfter && { updatedAt: { gte: updatedAfter } }),
            ...(updatedBefore && { updatedAt: { lte: updatedBefore } }),
          };

          const projects = await ctx.db.project.findMany({
            where: projectWhere,
            take: limit,
            orderBy: getProjectOrderBy(sortBy, sortOrder),
            include: {
              _count: {
                select: {
                  tasks: true,
                  notes: true,
                },
              },
            },
          });

          results.projects = projects;
          results.totalCount += projects.length;
        }

        // 搜索日志
        if (searchIn.includes("journals")) {
          const journalWhere: any = {
            createdById: ctx.session.user.id,
            ...(query && {
              content: { contains: query, mode: "insensitive" as const },
            }),
            ...(createdAfter && { date: { gte: createdAfter } }),
            ...(createdBefore && { date: { lte: createdBefore } }),
          };

          const journals = await ctx.db.journal.findMany({
            where: journalWhere,
            take: limit,
            orderBy: { date: sortOrder },
          });

          results.journals = journals;
          results.totalCount += journals.length;
        }

        return results;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "搜索失败",
          cause: error,
        });
      }
    }),

  // 搜索建议
  suggestions: protectedProcedure
    .input(searchSuggestionsSchema)
    .query(async ({ ctx, input }) => {
      const { query, type, limit } = input;

      try {
        const suggestions: any = {
          tasks: [],
          tags: [],
          projects: [],
        };

        if (type === "all" || type === "tasks") {
          const tasks = await ctx.db.task.findMany({
            where: {
              createdById: ctx.session.user.id,
              title: { contains: query, mode: "insensitive" as const },
            },
            select: {
              id: true,
              title: true,
              status: true,
            },
            take: limit,
            orderBy: { updatedAt: "desc" },
          });
          suggestions.tasks = tasks;
        }

        if (type === "all" || type === "tags") {
          const tags = await ctx.db.tag.findMany({
            where: {
              createdById: ctx.session.user.id,
              name: { contains: query, mode: "insensitive" as const },
            },
            select: {
              id: true,
              name: true,
              color: true,
              type: true,
              icon: true,
            },
            take: limit,
            orderBy: { name: "asc" },
          });
          suggestions.tags = tags;
        }

        if (type === "all" || type === "projects") {
          const projects = await ctx.db.project.findMany({
            where: {
              createdById: ctx.session.user.id,
              name: { contains: query, mode: "insensitive" as const },
            },
            select: {
              id: true,
              name: true,
              color: true,
            },
            take: limit,
            orderBy: { name: "asc" },
          });
          suggestions.projects = projects;
        }

        return suggestions;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取搜索建议失败",
          cause: error,
        });
      }
    }),

  // 保存搜索
  saveSearch: protectedProcedure
    .input(savedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 检查搜索名称是否已存在
        const existingSearch = await ctx.db.savedSearch.findFirst({
          where: {
            name: input.name,
            createdById: ctx.session.user.id,
          },
        });

        if (existingSearch) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "搜索名称已存在",
          });
        }

        const savedSearch = await ctx.db.savedSearch.create({
          data: {
            ...input,
            searchParams: JSON.stringify(input.searchParams),
            createdById: ctx.session.user.id,
          },
        });

        return savedSearch;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "保存搜索失败",
          cause: error,
        });
      }
    }),

  // 获取保存的搜索列表
  getSavedSearches: protectedProcedure.query(async ({ ctx }) => {
    try {
      const savedSearches = await ctx.db.savedSearch.findMany({
        where: {
          createdById: ctx.session.user.id,
        },
        orderBy: { updatedAt: "desc" },
      });

      return savedSearches.map((search) => ({
        ...search,
        searchParams: JSON.parse(search.searchParams),
      }));
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取保存的搜索失败",
        cause: error,
      });
    }
  }),

  // 删除保存的搜索
  deleteSavedSearch: protectedProcedure
    .input(searchIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证搜索所有权
        const savedSearch = await ctx.db.savedSearch.findUnique({
          where: { id: input.id },
          select: { createdById: true },
        });

        if (!savedSearch || savedSearch.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "保存的搜索不存在或无权限操作",
          });
        }

        await ctx.db.savedSearch.delete({
          where: { id: input.id },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除保存的搜索失败",
          cause: error,
        });
      }
    }),
});

// 辅助函数：获取任务排序
function getTaskOrderBy(sortBy: string, sortOrder: "asc" | "desc") {
  switch (sortBy) {
    case "createdAt":
      return { createdAt: sortOrder };
    case "updatedAt":
      return { updatedAt: sortOrder };
    case "dueDate":
      return { dueDate: sortOrder };
    case "priority":
      return { priority: sortOrder };
    case "title":
      return { title: sortOrder };
    case "timeSpent":
      return { totalTimeSpent: sortOrder };
    default:
      return { updatedAt: "desc" as const };
  }
}

// 辅助函数：获取笔记排序
function getNoteOrderBy(sortBy: string, sortOrder: "asc" | "desc") {
  switch (sortBy) {
    case "createdAt":
      return { createdAt: sortOrder };
    case "updatedAt":
      return { updatedAt: sortOrder };
    case "title":
      return { title: sortOrder };
    default:
      return { updatedAt: "desc" as const };
  }
}

// 辅助函数：获取项目排序
function getProjectOrderBy(sortBy: string, sortOrder: "asc" | "desc") {
  switch (sortBy) {
    case "createdAt":
      return { createdAt: sortOrder };
    case "updatedAt":
      return { updatedAt: sortOrder };
    case "title":
      return { name: sortOrder };
    default:
      return { updatedAt: "desc" as const };
  }
}

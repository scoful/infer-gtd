import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TagType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// 标签相关的 Schema
const createTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空").max(50, "标签名称过长"),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "颜色格式无效")
    .optional(),
  type: z.nativeEnum(TagType).default(TagType.CUSTOM),
  category: z.string().max(50, "分类名称过长").optional(),
  description: z.string().max(200, "描述过长").optional(),
  icon: z.string().max(10, "图标过长").optional(),
});

const updateTagSchema = z.object({
  id: z.string().cuid("无效的标签ID"),
  name: z
    .string()
    .min(1, "标签名称不能为空")
    .max(50, "标签名称过长")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "颜色格式无效")
    .optional(),
  type: z.nativeEnum(TagType).optional(),
  category: z.string().max(50, "分类名称过长").optional(),
  description: z.string().max(200, "描述过长").optional(),
  icon: z.string().max(10, "图标过长").optional(),
});

const getTagsSchema = z.object({
  type: z.nativeEnum(TagType).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  includeSystem: z.boolean().default(true),
  includeCount: z.boolean().default(true), // 是否包含使用统计
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
});

const tagIdSchema = z.object({
  id: z.string().cuid("无效的标签ID"),
});

const batchCreateTagsSchema = z.object({
  tags: z
    .array(createTagSchema)
    .min(1, "至少需要一个标签")
    .max(20, "一次最多创建20个标签"),
});

const batchDeleteTagsSchema = z.object({
  tagIds: z
    .array(z.string().cuid("无效的标签ID"))
    .min(1, "至少选择一个标签")
    .max(50, "一次最多删除50个标签"),
});

export const tagRouter = createTRPCRouter({
  // 创建标签
  create: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 检查标签名称是否已存在
        const existingTag = await ctx.db.tag.findFirst({
          where: {
            name: input.name,
            createdById: ctx.session.user.id,
          },
        });

        if (existingTag) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "标签名称已存在",
          });
        }

        // 创建标签
        const tag = await ctx.db.tag.create({
          data: {
            ...input,
            createdById: ctx.session.user.id,
          },
        });

        return tag;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建标签失败",
          cause: error,
        });
      }
    }),

  // 批量创建标签
  batchCreate: protectedProcedure
    .input(batchCreateTagsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 检查标签名称是否已存在
        const existingTags = await ctx.db.tag.findMany({
          where: {
            name: { in: input.tags.map((tag) => tag.name) },
            createdById: ctx.session.user.id,
          },
          select: { name: true },
        });

        const existingNames = existingTags.map((tag) => tag.name);
        const duplicateNames = input.tags
          .map((tag) => tag.name)
          .filter((name) => existingNames.includes(name));

        if (duplicateNames.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `以下标签名称已存在: ${duplicateNames.join(", ")}`,
          });
        }

        // 批量创建标签
        const tags = await ctx.db.tag.createMany({
          data: input.tags.map((tag) => ({
            ...tag,
            createdById: ctx.session.user.id,
          })),
        });

        return tags;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量创建标签失败",
          cause: error,
        });
      }
    }),

  // 获取标签列表
  getAll: protectedProcedure
    .input(getTagsSchema)
    .query(async ({ ctx, input }) => {
      const {
        limit,
        cursor,
        search,
        type,
        category,
        includeSystem,
        includeCount,
      } = input;

      try {
        const where = {
          createdById: ctx.session.user.id,
          ...(type && { type }),
          ...(category && { category }),
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                description: { contains: search, mode: "insensitive" as const },
              },
            ],
          }),
          ...(includeSystem === false && { isSystem: false }),
        };

        const tags = await ctx.db.tag.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: [
            { isSystem: "desc" }, // 系统标签优先
            { type: "asc" },
            { name: "asc" },
          ],
          ...(includeCount && {
            include: {
              _count: {
                select: {
                  taskTags: true,
                  noteTags: true,
                },
              },
            },
          }),
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (tags.length > limit) {
          const nextItem = tags.pop();
          nextCursor = nextItem!.id;
        }

        return {
          tags,
          nextCursor,
          hasNextPage: !!nextCursor,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取标签列表失败",
          cause: error,
        });
      }
    }),

  // 根据类型获取标签
  getByType: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(TagType),
        includeSystem: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const tags = await ctx.db.tag.findMany({
          where: {
            createdById: ctx.session.user.id,
            type: input.type,
            ...(input.includeSystem === false && { isSystem: false }),
          },
          orderBy: [{ isSystem: "desc" }, { name: "asc" }],
          include: {
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        return tags;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取标签失败",
          cause: error,
        });
      }
    }),

  // 根据分类获取标签
  getByCategory: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        includeSystem: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const tags = await ctx.db.tag.findMany({
          where: {
            createdById: ctx.session.user.id,
            category: input.category,
            ...(input.includeSystem === false && { isSystem: false }),
          },
          orderBy: [{ isSystem: "desc" }, { name: "asc" }],
          include: {
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        return tags;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取标签失败",
          cause: error,
        });
      }
    }),

  // 根据ID获取标签详情
  getById: protectedProcedure
    .input(tagIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const tag = await ctx.db.tag.findUnique({
          where: { id: input.id },
          include: {
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        if (!tag || tag.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "标签不存在或无权限访问",
          });
        }

        return tag;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取标签详情失败",
          cause: error,
        });
      }
    }),

  // 更新标签
  update: protectedProcedure
    .input(updateTagSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      try {
        // 验证标签所有权
        const tag = await ctx.db.tag.findUnique({
          where: { id },
          select: { createdById: true, isSystem: true, name: true },
        });

        if (!tag || tag.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "标签不存在或无权限操作",
          });
        }

        // 系统标签不允许修改某些字段
        if (tag.isSystem && (updateData.type || updateData.category)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "系统标签不允许修改类型和分类",
          });
        }

        // 检查名称是否重复（如果要修改名称）
        if (updateData.name && updateData.name !== tag.name) {
          const existingTag = await ctx.db.tag.findFirst({
            where: {
              name: updateData.name,
              createdById: ctx.session.user.id,
              id: { not: id },
            },
          });

          if (existingTag) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "标签名称已存在",
            });
          }
        }

        // 更新标签
        const updatedTag = await ctx.db.tag.update({
          where: { id },
          data: updateData,
          include: {
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        return updatedTag;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新标签失败",
          cause: error,
        });
      }
    }),

  // 删除标签
  delete: protectedProcedure
    .input(tagIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证标签所有权
        const tag = await ctx.db.tag.findUnique({
          where: { id: input.id },
          select: {
            createdById: true,
            isSystem: true,
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        if (!tag || tag.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "标签不存在或无权限操作",
          });
        }

        // 系统标签不允许删除
        if (tag.isSystem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "系统标签不允许删除",
          });
        }

        // 检查是否有关联的任务或笔记
        if (tag._count.taskTags > 0 || tag._count.noteTags > 0) {
          // 获取具体的引用信息
          const taskCount = tag._count.taskTags;
          const noteCount = tag._count.noteTags;

          let message = "标签正在被使用，无法删除。\n\n";
          if (taskCount > 0) {
            message += `• 被 ${taskCount} 个任务使用\n`;
          }
          if (noteCount > 0) {
            message += `• 被 ${noteCount} 个笔记使用\n`;
          }
          message += "\n请先移除这些引用，然后再删除标签。";

          throw new TRPCError({
            code: "CONFLICT",
            message,
            cause: {
              taskCount,
              noteCount,
              totalCount: taskCount + noteCount,
            },
          });
        }

        // 删除标签
        await ctx.db.tag.delete({
          where: { id: input.id },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除标签失败",
          cause: error,
        });
      }
    }),

  // 获取标签统计信息
  getStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stats = await ctx.db.tag.groupBy({
        by: ["type"],
        where: {
          createdById: ctx.session.user.id,
        },
        _count: {
          id: true,
        },
      });

      const totalTags = await ctx.db.tag.count({
        where: {
          createdById: ctx.session.user.id,
        },
      });

      const systemTags = await ctx.db.tag.count({
        where: {
          createdById: ctx.session.user.id,
          isSystem: true,
        },
      });

      return {
        total: totalTags,
        system: systemTags,
        custom: totalTags - systemTags,
        byType: stats.reduce(
          (acc, stat) => {
            acc[stat.type] = stat._count.id;
            return acc;
          },
          {} as Record<TagType, number>,
        ),
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取标签统计失败",
        cause: error,
      });
    }
  }),

  // 批量删除标签
  batchDelete: protectedProcedure
    .input(batchDeleteTagsSchema)
    .mutation(async ({ ctx, input }) => {
      const { tagIds } = input;

      try {
        // 验证所有标签的所有权和状态
        const tags = await ctx.db.tag.findMany({
          where: {
            id: { in: tagIds },
            createdById: ctx.session.user.id,
          },
          select: {
            id: true,
            name: true,
            isSystem: true,
            _count: {
              select: {
                taskTags: true,
                noteTags: true,
              },
            },
          },
        });

        if (tags.length !== tagIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分标签不存在或无权限删除",
          });
        }

        // 检查系统标签
        const systemTags = tags.filter((tag) => tag.isSystem);
        if (systemTags.length > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `系统标签不允许删除: ${systemTags.map((tag) => tag.name).join(", ")}`,
          });
        }

        // 检查被引用的标签
        const referencedTags = tags.filter(
          (tag) => tag._count.taskTags > 0 || tag._count.noteTags > 0,
        );

        if (referencedTags.length > 0) {
          const referencedNames = referencedTags
            .map((tag) => {
              const taskCount = tag._count.taskTags;
              const noteCount = tag._count.noteTags;
              const totalCount = taskCount + noteCount;
              return `${tag.name} (${totalCount}处引用)`;
            })
            .join(", ");

          throw new TRPCError({
            code: "CONFLICT",
            message: `以下标签正在被使用，无法删除:\n\n${referencedNames}\n\n请先移除这些引用，然后再删除标签。`,
          });
        }

        // 批量删除标签
        const deletedTags = await ctx.db.tag.deleteMany({
          where: {
            id: { in: tagIds },
            createdById: ctx.session.user.id,
          },
        });

        return {
          success: true,
          message: `成功删除 ${deletedTags.count} 个标签`,
          deletedCount: deletedTags.count,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量删除标签失败",
          cause: error,
        });
      }
    }),
});

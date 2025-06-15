import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  createNoteSchema,
  updateNoteSchema,
  getNotesSchema,
  noteIdSchema,
  archiveNoteSchema,
  linkNoteToTaskSchema,
  unlinkNoteFromTaskSchema,
  batchNoteOperationSchema,
  searchNotesSchema,
  getNoteStatsSchema,
} from "@/server/api/schemas/note";

export const noteRouter = createTRPCRouter({
  // 创建笔记
  create: protectedProcedure
    .input(createNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const { tagIds, linkedTaskIds, ...noteData } = input;

      try {
        // 验证项目所有权（如果指定了项目）
        if (input.projectId) {
          const project = await ctx.db.project.findUnique({
            where: { id: input.projectId },
            select: { createdById: true },
          });

          if (!project || project.createdById !== ctx.session.user.id) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "项目不存在或无权限访问",
            });
          }
        }

        // 验证标签所有权（如果指定了标签）
        if (tagIds && tagIds.length > 0) {
          const tags = await ctx.db.tag.findMany({
            where: {
              id: { in: tagIds },
              createdById: ctx.session.user.id,
            },
          });

          if (tags.length !== tagIds.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "部分标签不存在或无权限访问",
            });
          }
        }

        // 验证任务所有权（如果指定了关联任务）
        if (linkedTaskIds && linkedTaskIds.length > 0) {
          const tasks = await ctx.db.task.findMany({
            where: {
              id: { in: linkedTaskIds },
              createdById: ctx.session.user.id,
            },
          });

          if (tasks.length !== linkedTaskIds.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "部分任务不存在或无权限访问",
            });
          }
        }

        // 创建笔记
        const note = await ctx.db.note.create({
          data: {
            ...noteData,
            createdById: ctx.session.user.id,
            tags: tagIds ? {
              create: tagIds.map(tagId => ({
                tag: { connect: { id: tagId } },
              })),
            } : undefined,
            linkedTasks: linkedTaskIds ? {
              connect: linkedTaskIds.map(taskId => ({ id: taskId })),
            } : undefined,
          },
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

        return note;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建笔记失败",
          cause: error,
        });
      }
    }),

  // 获取笔记列表
  getAll: protectedProcedure
    .input(getNotesSchema)
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, sortBy, sortOrder, includeArchived, ...filters } = input;

      try {
        const where = {
          createdById: ctx.session.user.id,
          ...filters,
          ...(includeArchived ? {} : { isArchived: false }),
          ...(search && {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { content: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const orderBy = { [sortBy]: sortOrder };

        const notes = await ctx.db.note.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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
            _count: {
              select: {
                linkedTasks: true,
              },
            },
          },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (notes.length > limit) {
          const nextItem = notes.pop();
          nextCursor = nextItem!.id;
        }

        return {
          notes,
          nextCursor,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取笔记列表失败",
          cause: error,
        });
      }
    }),

  // 根据ID获取笔记详情
  getById: protectedProcedure
    .input(noteIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const note = await ctx.db.note.findUnique({
          where: { id: input.id },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
            },
            linkedTasks: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        });

        if (!note || note.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限访问",
          });
        }

        return note;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取笔记详情失败",
          cause: error,
        });
      }
    }),

  // 更新笔记
  update: protectedProcedure
    .input(updateNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, linkedTaskIds, ...updateData } = input;

      try {
        // 验证笔记所有权
        const existingNote = await ctx.db.note.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!existingNote || existingNote.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限修改",
          });
        }

        // 验证项目所有权（如果更新了项目）
        if (updateData.projectId) {
          const project = await ctx.db.project.findUnique({
            where: { id: updateData.projectId },
            select: { createdById: true },
          });

          if (!project || project.createdById !== ctx.session.user.id) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "项目不存在或无权限访问",
            });
          }
        }

        // 验证标签所有权（如果更新了标签）
        if (tagIds && tagIds.length > 0) {
          const tags = await ctx.db.tag.findMany({
            where: {
              id: { in: tagIds },
              createdById: ctx.session.user.id,
            },
          });

          if (tags.length !== tagIds.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "部分标签不存在或无权限访问",
            });
          }
        }

        // 验证任务所有权（如果更新了关联任务）
        if (linkedTaskIds && linkedTaskIds.length > 0) {
          const tasks = await ctx.db.task.findMany({
            where: {
              id: { in: linkedTaskIds },
              createdById: ctx.session.user.id,
            },
          });

          if (tasks.length !== linkedTaskIds.length) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "部分任务不存在或无权限访问",
            });
          }
        }

        // 更新笔记
        const note = await ctx.db.note.update({
          where: { id },
          data: {
            ...updateData,
            ...(tagIds !== undefined && {
              tags: {
                deleteMany: {},
                create: tagIds.map(tagId => ({
                  tag: { connect: { id: tagId } },
                })),
              },
            }),
            ...(linkedTaskIds !== undefined && {
              linkedTasks: {
                set: linkedTaskIds.map(taskId => ({ id: taskId })),
              },
            }),
          },
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

        return note;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新笔记失败",
          cause: error,
        });
      }
    }),

  // 删除笔记
  delete: protectedProcedure
    .input(noteIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证笔记所有权
        const note = await ctx.db.note.findUnique({
          where: { id: input.id },
          select: { createdById: true, title: true },
        });

        if (!note || note.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限删除",
          });
        }

        // 删除笔记（级联删除相关数据）
        await ctx.db.note.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: `笔记 "${note.title}" 已删除`
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除笔记失败",
          cause: error,
        });
      }
    }),

  // 归档/恢复笔记
  archive: protectedProcedure
    .input(archiveNoteSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证笔记所有权
        const note = await ctx.db.note.findUnique({
          where: { id: input.id },
          select: { createdById: true, title: true, isArchived: true },
        });

        if (!note || note.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限操作",
          });
        }

        if (note.isArchived === input.isArchived) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: input.isArchived ? "笔记已经是归档状态" : "笔记已经是活跃状态",
          });
        }

        // 更新归档状态
        const updatedNote = await ctx.db.note.update({
          where: { id: input.id },
          data: { isArchived: input.isArchived },
        });

        return {
          success: true,
          message: input.isArchived
            ? `笔记 "${note.title}" 已归档`
            : `笔记 "${note.title}" 已恢复`,
          note: updatedNote,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "归档笔记失败",
          cause: error,
        });
      }
    }),

  // 关联笔记到任务
  linkToTask: protectedProcedure
    .input(linkNoteToTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证笔记所有权
        const note = await ctx.db.note.findUnique({
          where: { id: input.noteId },
          select: { createdById: true, title: true },
        });

        if (!note || note.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限操作",
          });
        }

        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.taskId },
          select: { createdById: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        // 检查是否已经关联
        const existingLink = await ctx.db.note.findFirst({
          where: {
            id: input.noteId,
            linkedTasks: {
              some: { id: input.taskId },
            },
          },
        });

        if (existingLink) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "笔记已经关联到该任务",
          });
        }

        // 创建关联
        await ctx.db.note.update({
          where: { id: input.noteId },
          data: {
            linkedTasks: {
              connect: { id: input.taskId },
            },
          },
        });

        return {
          success: true,
          message: `笔记 "${note.title}" 已关联到任务 "${task.title}"`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "关联笔记到任务失败",
          cause: error,
        });
      }
    }),

  // 取消笔记与任务的关联
  unlinkFromTask: protectedProcedure
    .input(unlinkNoteFromTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证笔记所有权
        const note = await ctx.db.note.findUnique({
          where: { id: input.noteId },
          select: { createdById: true, title: true },
        });

        if (!note || note.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "笔记不存在或无权限操作",
          });
        }

        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.taskId },
          select: { createdById: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        // 取消关联
        await ctx.db.note.update({
          where: { id: input.noteId },
          data: {
            linkedTasks: {
              disconnect: { id: input.taskId },
            },
          },
        });

        return {
          success: true,
          message: `笔记 "${note.title}" 已取消与任务 "${task.title}" 的关联`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "取消笔记任务关联失败",
          cause: error,
        });
      }
    }),

  // 搜索笔记
  search: protectedProcedure
    .input(searchNotesSchema)
    .query(async ({ ctx, input }) => {
      const { query, limit, cursor, includeArchived, projectId } = input;

      try {
        const where = {
          createdById: ctx.session.user.id,
          ...(projectId && { projectId }),
          ...(includeArchived ? {} : { isArchived: false }),
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { content: { contains: query, mode: "insensitive" as const } },
          ],
        };

        const notes = await ctx.db.note.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { updatedAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: {
                linkedTasks: true,
              },
            },
          },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (notes.length > limit) {
          const nextItem = notes.pop();
          nextCursor = nextItem!.id;
        }

        return {
          notes,
          nextCursor,
          total: notes.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "搜索笔记失败",
          cause: error,
        });
      }
    }),

  // 获取笔记统计
  getStats: protectedProcedure
    .input(getNoteStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          createdById: ctx.session.user.id,
        };

        if (input.projectId) {
          where.projectId = input.projectId;
        }

        if (input.startDate || input.endDate) {
          where.createdAt = {};
          if (input.startDate) {
            where.createdAt.gte = input.startDate;
          }
          if (input.endDate) {
            where.createdAt.lte = input.endDate;
          }
        }

        const [totalNotes, archivedNotes, notesWithTasks] = await Promise.all([
          ctx.db.note.count({ where }),
          ctx.db.note.count({ where: { ...where, isArchived: true } }),
          ctx.db.note.count({
            where: {
              ...where,
              linkedTasks: {
                some: {},
              },
            },
          }),
        ]);

        const activeNotes = totalNotes - archivedNotes;

        return {
          totalNotes,
          activeNotes,
          archivedNotes,
          notesWithTasks,
          notesWithoutTasks: totalNotes - notesWithTasks,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取笔记统计失败",
          cause: error,
        });
      }
    }),

  // 批量操作笔记
  batchOperation: protectedProcedure
    .input(batchNoteOperationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证所有笔记的所有权
        const notes = await ctx.db.note.findMany({
          where: {
            id: { in: input.noteIds },
            createdById: ctx.session.user.id,
          },
          select: { id: true, title: true, isArchived: true },
        });

        if (notes.length !== input.noteIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分笔记不存在或无权限操作",
          });
        }

        let result: { success: boolean; message: string };

        switch (input.operation) {
          case "archive":
            await ctx.db.note.updateMany({
              where: { id: { in: input.noteIds } },
              data: { isArchived: true },
            });
            result = {
              success: true,
              message: `已归档 ${notes.length} 篇笔记`,
            };
            break;

          case "unarchive":
            await ctx.db.note.updateMany({
              where: { id: { in: input.noteIds } },
              data: { isArchived: false },
            });
            result = {
              success: true,
              message: `已恢复 ${notes.length} 篇笔记`,
            };
            break;

          case "delete":
            await ctx.db.note.deleteMany({
              where: { id: { in: input.noteIds } },
            });
            result = {
              success: true,
              message: `已删除 ${notes.length} 篇笔记`,
            };
            break;

          case "move":
            if (!input.targetProjectId) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "移动操作需要指定目标项目",
              });
            }

            // 验证目标项目所有权
            const targetProject = await ctx.db.project.findUnique({
              where: { id: input.targetProjectId },
              select: { createdById: true, name: true },
            });

            if (!targetProject || targetProject.createdById !== ctx.session.user.id) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "目标项目不存在或无权限访问",
              });
            }

            await ctx.db.note.updateMany({
              where: { id: { in: input.noteIds } },
              data: { projectId: input.targetProjectId },
            });
            result = {
              success: true,
              message: `已将 ${notes.length} 篇笔记移动到项目 "${targetProject.name}"`,
            };
            break;

          default:
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "无效的操作类型",
            });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量操作失败",
          cause: error,
        });
      }
    }),
});

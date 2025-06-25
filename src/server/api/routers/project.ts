import { TRPCError } from "@trpc/server";
import { TaskStatus } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  archiveProjectSchema,
  batchProjectOperationSchema,
  createProjectSchema,
  getProjectNotesSchema,
  getProjectsSchema,
  getProjectStatsSchema,
  getProjectTasksSchema,
  projectIdSchema,
  updateProjectSchema,
} from "@/server/api/schemas/project";

export const projectRouter = createTRPCRouter({
  // 创建项目
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 检查项目名称是否重复
        const existingProject = await ctx.db.project.findFirst({
          where: {
            name: input.name,
            createdById: ctx.session.user.id,
            isArchived: false,
          },
        });

        if (existingProject) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "项目名称已存在",
          });
        }

        // 创建项目
        const project = await ctx.db.project.create({
          data: {
            ...input,
            createdById: ctx.session.user.id,
          },
        });

        return project;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建项目失败",
          cause: error,
        });
      }
    }),

  // 获取项目列表
  getAll: protectedProcedure
    .input(getProjectsSchema)
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, includeArchived } = input;

      try {
        const where = {
          createdById: ctx.session.user.id,
          ...(includeArchived ? {} : { isArchived: false }),
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                description: { contains: search, mode: "insensitive" as const },
              },
            ],
          }),
        };

        const projects = await ctx.db.project.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: [{ isArchived: "asc" }, { name: "asc" }],
          include: {
            _count: {
              select: {
                tasks: true,
                notes: true,
              },
            },
          },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (projects.length > limit) {
          const nextItem = projects.pop();
          nextCursor = nextItem!.id;
        }

        return {
          projects,
          nextCursor,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取项目列表失败",
          cause: error,
        });
      }
    }),

  // 根据ID获取项目详情
  getById: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const project = await ctx.db.project.findUnique({
          where: { id: input.id },
          include: {
            tasks: {
              orderBy: { createdAt: "desc" },
              take: 10,
              include: {
                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
            notes: {
              orderBy: { updatedAt: "desc" },
              take: 5,
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
            _count: {
              select: {
                tasks: true,
                notes: true,
              },
            },
          },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限访问",
          });
        }

        return project;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取项目详情失败",
          cause: error,
        });
      }
    }),

  // 更新项目
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      try {
        // 验证项目所有权
        const existingProject = await ctx.db.project.findUnique({
          where: { id },
          select: { createdById: true, name: true },
        });

        if (
          !existingProject ||
          existingProject.createdById !== ctx.session.user.id
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限修改",
          });
        }

        // 如果更新名称，检查是否重复
        if (updateData.name && updateData.name !== existingProject.name) {
          const duplicateProject = await ctx.db.project.findFirst({
            where: {
              name: updateData.name,
              createdById: ctx.session.user.id,
              isArchived: false,
              id: { not: id },
            },
          });

          if (duplicateProject) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "项目名称已存在",
            });
          }
        }

        // 更新项目
        const project = await ctx.db.project.update({
          where: { id },
          data: updateData,
          include: {
            _count: {
              select: {
                tasks: true,
                notes: true,
              },
            },
          },
        });

        return project;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新项目失败",
          cause: error,
        });
      }
    }),

  // 删除项目
  delete: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证项目所有权
        const project = await ctx.db.project.findUnique({
          where: { id: input.id },
          select: {
            createdById: true,
            name: true,
            _count: {
              select: {
                tasks: true,
                notes: true,
              },
            },
          },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限删除",
          });
        }

        // 检查是否有关联的任务或笔记
        if (project._count.tasks > 0 || project._count.notes > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `项目 "${project.name}" 包含 ${project._count.tasks} 个任务和 ${project._count.notes} 篇笔记，请先处理这些内容或将项目归档`,
          });
        }

        // 删除项目
        await ctx.db.project.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: `项目 "${project.name}" 已删除`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除项目失败",
          cause: error,
        });
      }
    }),

  // 归档/恢复项目
  archive: protectedProcedure
    .input(archiveProjectSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证项目所有权
        const project = await ctx.db.project.findUnique({
          where: { id: input.id },
          select: { createdById: true, name: true, isArchived: true },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限操作",
          });
        }

        if (project.isArchived === input.isArchived) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: input.isArchived
              ? "项目已经是归档状态"
              : "项目已经是活跃状态",
          });
        }

        // 更新归档状态
        const updatedProject = await ctx.db.project.update({
          where: { id: input.id },
          data: { isArchived: input.isArchived },
        });

        return {
          success: true,
          message: input.isArchived
            ? `项目 "${project.name}" 已归档`
            : `项目 "${project.name}" 已恢复`,
          project: updatedProject,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "归档项目失败",
          cause: error,
        });
      }
    }),

  // 获取项目统计信息
  getStats: protectedProcedure
    .input(getProjectStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        // 验证项目所有权
        const project = await ctx.db.project.findUnique({
          where: { id: input.id },
          select: { createdById: true, name: true },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限访问",
          });
        }

        const where: any = {
          projectId: input.id,
        };

        if (input.startDate || input.endDate) {
          where.createdAt = {};
          if (input.startDate) {
            where.createdAt.gte = input.startDate;
          }
          if (input.endDate) {
            where.createdAt.lte = input.endDate;
          }
        }

        // 获取任务统计
        const [
          totalTasks,
          completedTasks,
          statusCounts,
          priorityCounts,
          totalTimeSpent,
          totalNotes,
        ] = await Promise.all([
          ctx.db.task.count({ where }),
          ctx.db.task.count({ where: { ...where, status: TaskStatus.DONE } }),
          ctx.db.task.groupBy({
            by: ["status"],
            where,
            _count: { status: true },
          }),
          ctx.db.task.groupBy({
            by: ["priority"],
            where,
            _count: { priority: true },
          }),
          ctx.db.task.aggregate({
            where,
            _sum: { totalTimeSpent: true },
          }),
          ctx.db.note.count({ where: { projectId: input.id } }),
        ]);

        const completionRate =
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        return {
          projectName: project.name,
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate * 100) / 100,
          totalNotes,
          statusCounts: statusCounts.reduce(
            (acc, item) => {
              acc[item.status] = item._count.status;
              return acc;
            },
            {} as Record<string, number>,
          ),
          priorityCounts: priorityCounts.reduce(
            (acc, item) => {
              if (item.priority) {
                acc[item.priority] = item._count.priority;
              }
              return acc;
            },
            {} as Record<string, number>,
          ),
          totalTimeSpent: totalTimeSpent._sum.totalTimeSpent ?? 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取项目统计失败",
          cause: error,
        });
      }
    }),

  // 获取项目任务
  getTasks: protectedProcedure
    .input(getProjectTasksSchema)
    .query(async ({ ctx, input }) => {
      const { id, limit, cursor, ...filters } = input;

      try {
        // 验证项目所有权
        const project = await ctx.db.project.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限访问",
          });
        }

        const where = {
          projectId: id,
          ...filters,
        };

        const tasks = await ctx.db.task.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: [
            { status: "asc" },
            { sortOrder: "asc" },
            { priority: "desc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
          ],
          include: {
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" }, // 按sortOrder排序
            },
            timeEntries: {
              where: { endTime: null },
              take: 1,
            },
          },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (tasks.length > limit) {
          const nextItem = tasks.pop();
          nextCursor = nextItem!.id;
        }

        return {
          tasks,
          nextCursor,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取项目任务失败",
          cause: error,
        });
      }
    }),

  // 获取项目笔记
  getNotes: protectedProcedure
    .input(getProjectNotesSchema)
    .query(async ({ ctx, input }) => {
      const { id, limit, cursor, search } = input;

      try {
        // 验证项目所有权
        const project = await ctx.db.project.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!project || project.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "项目不存在或无权限访问",
          });
        }

        const where = {
          projectId: id,
          ...(search && {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { content: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const notes = await ctx.db.note.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { updatedAt: "desc" },
          include: {
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
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取项目笔记失败",
          cause: error,
        });
      }
    }),

  // 批量操作项目
  batchOperation: protectedProcedure
    .input(batchProjectOperationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证所有项目的所有权
        const projects = await ctx.db.project.findMany({
          where: {
            id: { in: input.projectIds },
            createdById: ctx.session.user.id,
          },
          select: { id: true, name: true, isArchived: true },
        });

        if (projects.length !== input.projectIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分项目不存在或无权限操作",
          });
        }

        let result: { success: boolean; message: string };

        switch (input.operation) {
          case "archive":
            await ctx.db.project.updateMany({
              where: { id: { in: input.projectIds } },
              data: { isArchived: true },
            });
            result = {
              success: true,
              message: `已归档 ${projects.length} 个项目`,
            };
            break;

          case "unarchive":
            await ctx.db.project.updateMany({
              where: { id: { in: input.projectIds } },
              data: { isArchived: false },
            });
            result = {
              success: true,
              message: `已恢复 ${projects.length} 个项目`,
            };
            break;

          case "delete":
            // 检查是否有项目包含任务或笔记
            const projectsWithContent = await ctx.db.project.findMany({
              where: { id: { in: input.projectIds } },
              include: {
                _count: {
                  select: {
                    tasks: true,
                    notes: true,
                  },
                },
              },
            });

            const nonEmptyProjects = projectsWithContent.filter(
              (p) => p._count.tasks > 0 || p._count.notes > 0,
            );

            if (nonEmptyProjects.length > 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `以下项目包含任务或笔记，无法删除：${nonEmptyProjects.map((p) => p.name).join(", ")}`,
              });
            }

            await ctx.db.project.deleteMany({
              where: { id: { in: input.projectIds } },
            });
            result = {
              success: true,
              message: `已删除 ${projects.length} 个项目`,
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

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TaskStatus, TaskType, Priority } from "@prisma/client";
import { arrayMove } from "@dnd-kit/sortable";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  getTasksSchema,
  taskIdSchema,
  setRecurringSchema,
  timeTrackingSchema,
  getTimeEntriesSchema,
  getTaskStatsSchema,
  batchUpdateTasksSchema,
  batchDeleteTasksSchema,
  reorderTasksSchema,
  updateTaskStatusWithPositionSchema,
  updateTaskFeedbackSchema,
  postponeTaskSchema,
  getTasksByStatusSchema,
} from "@/server/api/schemas/task";

export const taskRouter = createTRPCRouter({
  // 创建任务
  create: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const { tagIds, ...taskData } = input;

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

        // 获取当前状态下的最小 sortOrder 值，新任务排在第一位
        const minSortOrder = await ctx.db.task.findFirst({
          where: {
            createdById: ctx.session.user.id,
            status: taskData.status || TaskStatus.TODO,
          },
          select: { sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });

        // 新任务的sortOrder比最小值小1，确保排在第一位
        const nextSortOrder = (minSortOrder?.sortOrder ?? 1) - 1;

        // 创建任务
        const task = await ctx.db.task.create({
          data: {
            ...taskData,
            sortOrder: nextSortOrder,
            createdById: ctx.session.user.id,
            tags: tagIds
              ? {
                  create: tagIds.map((tagId, index) => ({
                    tag: { connect: { id: tagId } },
                    sortOrder: index, // 按照数组顺序设置sortOrder
                  })),
                }
              : undefined,
          },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" }, // 按sortOrder排序
            },
            statusHistory: {
              orderBy: { changedAt: "desc" },
              take: 1,
            },
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: null,
            toStatus: task.status,
            taskId: task.id,
            changedById: ctx.session.user.id,
            note: "任务创建",
          },
        });

        return task;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建任务失败",
          cause: error,
        });
      }
    }),

  // 获取任务列表
  getAll: protectedProcedure
    .input(getTasksSchema)
    .query(async ({ ctx, input }) => {
      const {
        limit,
        cursor,
        search,
        tagIds,
        createdAfter,
        createdBefore,
        updatedAfter,
        updatedBefore,
        completedAfter,
        completedBefore,
        dueAfter,
        dueBefore,
        ...filters
      } = input;

      try {
        const where: any = {
          createdById: ctx.session.user.id,
          ...filters,
          ...(search && {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              {
                description: { contains: search, mode: "insensitive" as const },
              },
            ],
          }),
          // 标签筛选 - 使用包含关系（任务必须包含所有选中的标签）
          ...(tagIds &&
            tagIds.length > 0 && {
              AND: tagIds.map((tagId) => ({
                tags: {
                  some: {
                    tagId: tagId,
                  },
                },
              })),
            }),
        };

        // 日期筛选 - 分别处理每个日期字段
        if (createdAfter || createdBefore) {
          where.createdAt = {};
          if (createdAfter) where.createdAt.gte = createdAfter;
          if (createdBefore) where.createdAt.lte = createdBefore;
        }

        if (updatedAfter || updatedBefore) {
          where.updatedAt = {};
          if (updatedAfter) where.updatedAt.gte = updatedAfter;
          if (updatedBefore) where.updatedAt.lte = updatedBefore;
        }

        if (completedAfter || completedBefore) {
          where.completedAt = {};
          if (completedAfter) where.completedAt.gte = completedAfter;
          if (completedBefore) where.completedAt.lte = completedBefore;
        }

        if (dueAfter || dueBefore) {
          where.dueDate = {};
          if (dueAfter) where.dueDate.gte = dueAfter;
          if (dueBefore) where.dueDate.lte = dueBefore;
        }

        // 并行获取任务列表和总数
        const [tasks, totalCount] = await Promise.all([
          ctx.db.task.findMany({
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
              project: true,
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
              _count: {
                select: {
                  timeEntries: true,
                  statusHistory: true,
                },
              },
            },
          }),
          ctx.db.task.count({ where }),
        ]);

        let nextCursor: typeof cursor | undefined = undefined;
        if (tasks.length > limit) {
          const nextItem = tasks.pop();
          nextCursor = nextItem!.id;
        }

        return {
          tasks,
          nextCursor,
          totalCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取任务列表失败",
          cause: error,
        });
      }
    }),

  // 按状态获取任务列表
  getByStatus: protectedProcedure
    .input(getTasksByStatusSchema)
    .query(async ({ ctx, input }) => {
      const { status, limit, cursor } = input;

      try {
        const where = {
          createdById: ctx.session.user.id,
          status: status,
        };

        // 并行获取任务列表和总数
        const [tasks, totalCount] = await Promise.all([
          ctx.db.task.findMany({
            where,
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: [
              { sortOrder: "asc" },
              { priority: "desc" },
              { dueDate: "asc" },
              { createdAt: "desc" },
            ],
            include: {
              project: true,
              tags: {
                include: {
                  tag: true,
                },
                orderBy: { sortOrder: "asc" },
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
          }),
          ctx.db.task.count({ where }),
        ]);

        let nextCursor: typeof cursor | undefined = undefined;
        if (tasks.length > limit) {
          const nextItem = tasks.pop();
          nextCursor = nextItem!.id;
        }

        return {
          tasks,
          nextCursor,
          totalCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取任务列表失败",
          cause: error,
        });
      }
    }),

  // 根据ID获取任务详情
  getById: protectedProcedure
    .input(taskIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" }, // 按sortOrder排序
            },
            timeEntries: {
              orderBy: { startTime: "desc" },
            },
            statusHistory: {
              include: {
                changedBy: {
                  select: { name: true },
                },
              },
              orderBy: { changedAt: "desc" },
            },
            linkedNotes: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
          },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限访问",
          });
        }

        return task;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取任务详情失败",
          cause: error,
        });
      }
    }),

  // 更新任务
  update: protectedProcedure
    .input(updateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, status, ...updateData } = input;

      try {
        // 验证任务所有权并获取当前状态
        const existingTask = await ctx.db.task.findUnique({
          where: { id },
          select: { createdById: true, status: true, title: true },
        });

        if (!existingTask || existingTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
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

        // 处理状态变更
        const statusChanged =
          status !== undefined && status !== existingTask.status;
        let finalUpdateData = { ...updateData };

        if (statusChanged) {
          // 如果状态变为已完成，记录完成时间并增加完成次数
          if (status === TaskStatus.DONE) {
            (finalUpdateData as any).completedAt = new Date();
            (finalUpdateData as any).completedCount = { increment: 1 };
            (finalUpdateData as any).isTimerActive = false;
            (finalUpdateData as any).timerStartedAt = null;
          }

          // 如果从已完成状态变为其他状态，清除完成时间
          if (
            existingTask.status === TaskStatus.DONE &&
            status !== TaskStatus.DONE
          ) {
            (finalUpdateData as any).completedAt = null;
          }

          (finalUpdateData as any).status = status;
        }

        // 更新任务
        const task = await ctx.db.task.update({
          where: { id },
          data: {
            ...finalUpdateData,
            ...(tagIds !== undefined && {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId, index) => ({
                  tag: { connect: { id: tagId } },
                  sortOrder: index, // 按照数组顺序设置sortOrder
                })),
              },
            }),
          },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" }, // 按sortOrder排序
            },
          },
        });

        // 如果状态发生了变化，创建状态历史记录
        if (statusChanged) {
          await ctx.db.taskStatusHistory.create({
            data: {
              fromStatus: existingTask.status,
              toStatus: status!,
              taskId: id,
              changedById: ctx.session.user.id,
              note: "任务更新时状态变更",
            },
          });
        }

        return task;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新任务失败",
          cause: error,
        });
      }
    }),

  // 删除任务
  delete: protectedProcedure
    .input(taskIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: { createdById: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限删除",
          });
        }

        // 删除任务（级联删除相关数据）
        await ctx.db.task.delete({
          where: { id: input.id },
        });

        return { success: true, message: `任务 "${task.title}" 已删除` };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除任务失败",
          cause: error,
        });
      }
    }),

  // 更新任务状态
  updateStatus: protectedProcedure
    .input(updateTaskStatusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权并获取当前状态
        const existingTask = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: { createdById: true, status: true, title: true },
        });

        if (!existingTask || existingTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        const fromStatus = existingTask.status;
        const toStatus = input.status;

        // 如果状态没有变化，直接返回
        if (fromStatus === toStatus) {
          return { success: true, message: "任务状态未发生变化" };
        }

        // 更新任务状态
        const updateData: any = { status: toStatus };

        // 如果状态变为已完成，记录完成时间并增加完成次数
        if (toStatus === TaskStatus.DONE) {
          updateData.completedAt = new Date();
          updateData.completedCount = { increment: 1 };

          // 停止计时器（如果正在运行）
          updateData.isTimerActive = false;
          updateData.timerStartedAt = null;
        }

        // 如果从已完成状态变为其他状态，清除完成时间
        if (fromStatus === TaskStatus.DONE && toStatus !== TaskStatus.DONE) {
          updateData.completedAt = null;
        }

        const task = await ctx.db.task.update({
          where: { id: input.id },
          data: updateData,
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus,
            toStatus,
            taskId: input.id,
            changedById: ctx.session.user.id,
            note: input.note,
          },
        });

        return {
          success: true,
          message: `任务 "${existingTask.title}" 状态已更新为 ${toStatus}`,
          task,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新任务状态失败",
          cause: error,
        });
      }
    }),

  // 重启任务（将已完成的任务重新激活）
  restartTask: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid("无效的任务ID"),
        newStatus: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
        note: z.string().max(500, "备注过长").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: { createdById: true, status: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        if (
          task.status !== TaskStatus.DONE &&
          task.status !== TaskStatus.ARCHIVED
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "只能重启已完成或已归档的任务",
          });
        }

        // 重启任务
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            status: input.newStatus,
            completedAt: null,
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: task.status,
            toStatus: input.newStatus,
            taskId: input.id,
            changedById: ctx.session.user.id,
            note: input.note || "任务重启",
          },
        });

        return {
          success: true,
          message: `任务 "${task.title}" 已重启`,
          task: updatedTask,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "重启任务失败",
          cause: error,
        });
      }
    }),

  // 归档任务
  archiveTask: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid("无效的任务ID"),
        note: z.string().max(500, "备注过长").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: { createdById: true, status: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        if (task.status === TaskStatus.ARCHIVED) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务已经是归档状态",
          });
        }

        // 归档任务
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            status: TaskStatus.ARCHIVED,
            isTimerActive: false,
            timerStartedAt: null,
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: task.status,
            toStatus: TaskStatus.ARCHIVED,
            taskId: input.id,
            changedById: ctx.session.user.id,
            note: input.note || "任务归档",
          },
        });

        return {
          success: true,
          message: `任务 "${task.title}" 已归档`,
          task: updatedTask,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "归档任务失败",
          cause: error,
        });
      }
    }),

  // 开始计时
  startTimer: protectedProcedure
    .input(timeTrackingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: {
            createdById: true,
            title: true,
            isTimerActive: true,
            status: true,
          },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        if (task.isTimerActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务计时器已在运行中",
          });
        }

        if (
          task.status === TaskStatus.DONE ||
          task.status === TaskStatus.ARCHIVED
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "无法为已完成或已归档的任务开始计时",
          });
        }

        const now = new Date();

        // 停止用户的其他活跃计时器并正确处理时间累计
        const activeTimerTasks = await ctx.db.task.findMany({
          where: {
            createdById: ctx.session.user.id,
            isTimerActive: true,
          },
          select: {
            id: true,
            title: true,
            timerStartedAt: true,
            totalTimeSpent: true,
          },
        });

        // 为每个活跃的计时器任务处理时间累计
        for (const activeTask of activeTimerTasks) {
          if (activeTask.timerStartedAt) {
            // 计算本次会话时长
            const sessionDuration = Math.floor(
              (now.getTime() - activeTask.timerStartedAt.getTime()) / 1000,
            );

            // 查找当前活跃的时间记录
            const activeTimeEntry = await ctx.db.timeEntry.findFirst({
              where: {
                taskId: activeTask.id,
                endTime: null,
              },
              orderBy: { startTime: "desc" },
            });

            // 结束时间记录
            if (activeTimeEntry) {
              await ctx.db.timeEntry.update({
                where: { id: activeTimeEntry.id },
                data: {
                  endTime: now,
                  duration: sessionDuration,
                  description:
                    activeTimeEntry.description || "被其他任务计时中断",
                },
              });
            }

            // 更新任务的总时长和计时状态
            await ctx.db.task.update({
              where: { id: activeTask.id },
              data: {
                isTimerActive: false,
                timerStartedAt: null,
                totalTimeSpent: activeTask.totalTimeSpent + sessionDuration,
              },
            });
          }
        }

        // 开始新的计时
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            isTimerActive: true,
            timerStartedAt: now,
            status:
              task.status === TaskStatus.TODO
                ? TaskStatus.IN_PROGRESS
                : task.status,
          },
        });

        // 创建时间记录
        await ctx.db.timeEntry.create({
          data: {
            startTime: now,
            description: input.description,
            taskId: input.id,
            createdById: ctx.session.user.id,
          },
        });

        // 收集被中断任务的更新信息
        const interruptedTasksInfo = [];
        for (const activeTask of activeTimerTasks) {
          if (activeTask.timerStartedAt) {
            const sessionDuration = Math.floor(
              (now.getTime() - activeTask.timerStartedAt.getTime()) / 1000,
            );
            interruptedTasksInfo.push({
              id: activeTask.id,
              title: activeTask.title,
              totalTimeSpent: activeTask.totalTimeSpent + sessionDuration,
            });
          }
        }

        return {
          success: true,
          message: `开始为任务 "${task.title}" 计时`,
          task: updatedTask,
          interruptedTasks: interruptedTasksInfo, // 返回被中断任务的信息
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "开始计时失败",
          cause: error,
        });
      }
    }),

  // 暂停计时
  pauseTimer: protectedProcedure
    .input(timeTrackingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: {
            createdById: true,
            title: true,
            isTimerActive: true,
            timerStartedAt: true,
            totalTimeSpent: true,
          },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        if (!task.isTimerActive || !task.timerStartedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务计时器未在运行中",
          });
        }

        const now = new Date();
        const sessionDuration = Math.floor(
          (now.getTime() - task.timerStartedAt.getTime()) / 1000,
        );

        // 查找当前活跃的时间记录
        const activeTimeEntry = await ctx.db.timeEntry.findFirst({
          where: {
            taskId: input.id,
            endTime: null,
          },
          orderBy: { startTime: "desc" },
        });

        if (activeTimeEntry) {
          // 结束时间记录
          await ctx.db.timeEntry.update({
            where: { id: activeTimeEntry.id },
            data: {
              endTime: now,
              duration: sessionDuration,
              description: input.description || activeTimeEntry.description,
            },
          });
        }

        // 更新任务
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            isTimerActive: false,
            timerStartedAt: null,
            totalTimeSpent: task.totalTimeSpent + sessionDuration,
          },
        });

        const hours = Math.floor(sessionDuration / 3600);
        const minutes = Math.floor((sessionDuration % 3600) / 60);
        const timeString =
          hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;

        return {
          success: true,
          message: `任务 "${task.title}" 计时已暂停，本次用时 ${timeString}`,
          task: updatedTask,
          sessionDuration,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "暂停计时失败",
          cause: error,
        });
      }
    }),

  // 停止计时
  stopTimer: protectedProcedure
    .input(timeTrackingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: {
            createdById: true,
            title: true,
            isTimerActive: true,
            timerStartedAt: true,
            totalTimeSpent: true,
          },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        if (!task.isTimerActive || !task.timerStartedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务计时器未在运行中",
          });
        }

        const now = new Date();
        const sessionDuration = Math.floor(
          (now.getTime() - task.timerStartedAt.getTime()) / 1000,
        );

        // 查找当前活跃的时间记录
        const activeTimeEntry = await ctx.db.timeEntry.findFirst({
          where: {
            taskId: input.id,
            endTime: null,
          },
          orderBy: { startTime: "desc" },
        });

        if (activeTimeEntry) {
          // 结束时间记录
          await ctx.db.timeEntry.update({
            where: { id: activeTimeEntry.id },
            data: {
              endTime: now,
              duration: sessionDuration,
              description: input.description || activeTimeEntry.description,
            },
          });
        }

        // 更新任务并标记为已完成
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            isTimerActive: false,
            timerStartedAt: null,
            totalTimeSpent: task.totalTimeSpent + sessionDuration,
            status: TaskStatus.DONE,
            completedAt: now,
            completedCount: { increment: 1 },
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: TaskStatus.IN_PROGRESS,
            toStatus: TaskStatus.DONE,
            taskId: input.id,
            changedById: ctx.session.user.id,
            note: "计时结束，任务完成",
          },
        });

        const hours = Math.floor(sessionDuration / 3600);
        const minutes = Math.floor((sessionDuration % 3600) / 60);
        const timeString =
          hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;

        return {
          success: true,
          message: `任务 "${task.title}" 已完成，本次用时 ${timeString}`,
          task: updatedTask,
          sessionDuration,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "停止计时失败",
          cause: error,
        });
      }
    }),

  // 设置重复任务
  setRecurring: protectedProcedure
    .input(setRecurringSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证任务所有权
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: { createdById: true, title: true },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        // 更新任务的重复设置
        const updatedTask = await ctx.db.task.update({
          where: { id: input.id },
          data: {
            isRecurring: input.isRecurring,
            recurringPattern: input.recurringPattern
              ? JSON.stringify(input.recurringPattern)
              : null,
          },
        });

        return {
          success: true,
          message: input.isRecurring
            ? `任务 "${task.title}" 已设置为重复任务`
            : `任务 "${task.title}" 已取消重复设置`,
          task: updatedTask,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "设置重复任务失败",
          cause: error,
        });
      }
    }),

  // 生成重复任务的下一个实例
  generateNextInstance: protectedProcedure
    .input(taskIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 获取原始重复任务
        const originalTask = await ctx.db.task.findUnique({
          where: { id: input.id },
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        });

        if (!originalTask || originalTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        if (!originalTask.isRecurring || !originalTask.recurringPattern) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "任务不是重复任务",
          });
        }

        const pattern = JSON.parse(originalTask.recurringPattern);
        const now = new Date();
        let nextDueDate: Date | null = null;

        // 计算下一个到期日期
        switch (pattern.type) {
          case "daily":
            nextDueDate = new Date(
              now.getTime() + pattern.interval * 24 * 60 * 60 * 1000,
            );
            break;
          case "weekly":
            nextDueDate = new Date(
              now.getTime() + pattern.interval * 7 * 24 * 60 * 60 * 1000,
            );
            break;
          case "monthly":
            nextDueDate = new Date(now);
            nextDueDate.setMonth(nextDueDate.getMonth() + pattern.interval);
            break;
          case "yearly":
            nextDueDate = new Date(now);
            nextDueDate.setFullYear(
              nextDueDate.getFullYear() + pattern.interval,
            );
            break;
        }

        // 获取TODO状态下的最小sortOrder值，新循环任务排在第一位
        const minSortOrder = await ctx.db.task.findFirst({
          where: {
            createdById: ctx.session.user.id,
            status: TaskStatus.TODO,
          },
          select: { sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });

        const nextSortOrder = (minSortOrder?.sortOrder ?? 1) - 1;

        // 创建新的任务实例
        const newTask = await ctx.db.task.create({
          data: {
            title: originalTask.title,
            description: originalTask.description,
            type: originalTask.type,
            priority: originalTask.priority,
            status: TaskStatus.TODO,
            sortOrder: nextSortOrder, // 新循环任务排在第一位
            dueDate: nextDueDate,
            dueTime: pattern.time || originalTask.dueTime,
            isRecurring: true,
            recurringPattern: originalTask.recurringPattern,
            parentTaskId: originalTask.id,
            projectId: originalTask.projectId,
            createdById: ctx.session.user.id,
            tags: {
              create: originalTask.tags.map((taskTag) => ({
                tag: { connect: { id: taskTag.tag.id } },
                sortOrder: taskTag.sortOrder || 0, // 保持原有的sortOrder
              })),
            },
          },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" }, // 按sortOrder排序
            },
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: null,
            toStatus: TaskStatus.TODO,
            taskId: newTask.id,
            changedById: ctx.session.user.id,
            note: "重复任务实例创建",
          },
        });

        return {
          success: true,
          message: `已生成重复任务 "${originalTask.title}" 的新实例`,
          task: newTask,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "生成重复任务实例失败",
          cause: error,
        });
      }
    }),

  // 重新安排任务（手动复制任务）
  duplicateTask: protectedProcedure
    .input(taskIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 获取原任务详情
        const originalTask = await ctx.db.task.findUnique({
          where: { id: input.id },
          include: {
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (!originalTask || originalTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限操作",
          });
        }

        // 获取待办状态中的最小sortOrder，新任务排在第一位
        const minSortOrder = await ctx.db.task.findFirst({
          where: {
            createdById: ctx.session.user.id,
            status: TaskStatus.TODO,
          },
          select: { sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });

        const nextSortOrder = (minSortOrder?.sortOrder ?? 1) - 1;

        // 创建新任务（复制原任务内容）
        const newTask = await ctx.db.task.create({
          data: {
            title: originalTask.title,
            description: originalTask.description,
            type: originalTask.type,
            priority: originalTask.priority,
            status: TaskStatus.TODO, // 新任务状态为待办
            sortOrder: nextSortOrder, // 排在待办列表第一位
            dueDate: originalTask.dueDate,
            dueTime: originalTask.dueTime,
            projectId: originalTask.projectId,
            createdById: ctx.session.user.id,
            // 复制标签关系，保持原有排序
            tags: {
              create: originalTask.tags.map((taskTag) => ({
                tag: { connect: { id: taskTag.tag.id } },
                sortOrder: taskTag.sortOrder || 0,
              })),
            },
            // 注意：不设置 isRecurring, parentTaskId, recurringPattern
            // 这是一个独立的新任务，不是重复任务系统的一部分
          },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: null,
            toStatus: TaskStatus.TODO,
            taskId: newTask.id,
            changedById: ctx.session.user.id,
            note: "任务重新安排",
          },
        });

        return {
          success: true,
          message: `任务 "${originalTask.title}" 已重新安排到待办列表`,
          task: newTask,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "重新安排任务失败",
          cause: error,
        });
      }
    }),

  // 批量重新安排任务（批量复制任务到待办）
  batchDuplicateTasks: protectedProcedure
    .input(
      z.object({
        taskIds: z.array(z.string().cuid()).min(1, "至少选择一个任务"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 获取所有原任务详情
        const originalTasks = await ctx.db.task.findMany({
          where: {
            id: { in: input.taskIds },
            createdById: ctx.session.user.id,
          },
          include: {
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (originalTasks.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "未找到可重新安排的任务",
          });
        }

        // 获取待办状态中的最小sortOrder，新任务排在前面
        const minSortOrder = await ctx.db.task.findFirst({
          where: {
            createdById: ctx.session.user.id,
            status: TaskStatus.TODO,
          },
          select: { sortOrder: true },
          orderBy: { sortOrder: "asc" },
        });

        let nextSortOrder =
          (minSortOrder?.sortOrder ?? 1) - originalTasks.length;

        // 批量创建新任务
        const newTasks = await Promise.all(
          originalTasks.map(async (originalTask) => {
            const newTask = await ctx.db.task.create({
              data: {
                title: originalTask.title,
                description: originalTask.description,
                type: originalTask.type,
                priority: originalTask.priority,
                status: TaskStatus.TODO, // 新任务状态为待办
                sortOrder: nextSortOrder++, // 按顺序排列
                dueDate: originalTask.dueDate,
                dueTime: originalTask.dueTime,
                projectId: originalTask.projectId,
                createdById: ctx.session.user.id,
                // 复制标签关系，保持原有排序
                tags: {
                  create: originalTask.tags.map((taskTag) => ({
                    tag: { connect: { id: taskTag.tag.id } },
                    sortOrder: taskTag.sortOrder || 0,
                  })),
                },
              },
              include: {
                project: true,
                tags: {
                  include: {
                    tag: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            });

            // 创建状态历史记录
            await ctx.db.taskStatusHistory.create({
              data: {
                fromStatus: null,
                toStatus: TaskStatus.TODO,
                taskId: newTask.id,
                changedById: ctx.session.user.id,
                note: "批量重新安排",
              },
            });

            return newTask;
          }),
        );

        return {
          success: true,
          message: `成功重新安排 ${newTasks.length} 个任务到待办列表`,
          tasks: newTasks,
          count: newTasks.length,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量重新安排任务失败",
          cause: error,
        });
      }
    }),

  // 获取时间记录
  getTimeEntries: protectedProcedure
    .input(getTimeEntriesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          createdById: ctx.session.user.id,
        };

        if (input.taskId) {
          where.taskId = input.taskId;
        }

        if (input.startDate || input.endDate) {
          where.startTime = {};
          if (input.startDate) {
            where.startTime.gte = input.startDate;
          }
          if (input.endDate) {
            where.startTime.lte = input.endDate;
          }
        }

        const timeEntries = await ctx.db.timeEntry.findMany({
          where,
          take: input.limit,
          orderBy: { startTime: "desc" },
          include: {
            task: {
              select: {
                id: true,
                title: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        return {
          entries: timeEntries,
          totalCount: timeEntries.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取时间记录失败",
          cause: error,
        });
      }
    }),

  // 获取任务统计
  getStats: protectedProcedure
    .input(getTaskStatsSchema)
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

        // 获取任务统计
        const [
          totalTasks,
          completedTasks,
          statusCounts,
          priorityCounts,
          totalTimeSpent,
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
        ]);

        const completionRate =
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        return {
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate * 100) / 100,
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
          totalTimeSpent: totalTimeSpent._sum.totalTimeSpent || 0,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取任务统计失败",
          cause: error,
        });
      }
    }),

  // 重新排序任务
  reorder: protectedProcedure
    .input(reorderTasksSchema)
    .mutation(async ({ ctx, input }) => {
      const { taskIds, status, projectId } = input;

      try {
        // 验证所有任务的所有权
        const tasks = await ctx.db.task.findMany({
          where: {
            id: { in: taskIds },
            createdById: ctx.session.user.id,
            ...(status && { status }),
            ...(projectId && { projectId }),
          },
          select: { id: true, title: true, status: true },
        });

        if (tasks.length !== taskIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分任务不存在或无权限操作",
          });
        }

        // 批量更新任务的 sortOrder
        const updatePromises = taskIds.map((taskId, index) =>
          ctx.db.task.update({
            where: { id: taskId },
            data: { sortOrder: index },
          }),
        );

        await Promise.all(updatePromises);

        return {
          success: true,
          message: `已重新排序 ${taskIds.length} 个任务`,
          updatedCount: taskIds.length,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "重新排序任务失败",
          cause: error,
        });
      }
    }),

  // 带位置的状态更新
  updateStatusWithPosition: protectedProcedure
    .input(updateTaskStatusWithPositionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, status: newStatus, insertIndex, note } = input;

      try {
        // 验证任务所有权并获取当前状态
        const existingTask = await ctx.db.task.findUnique({
          where: { id },
          select: { createdById: true, status: true, title: true },
        });

        if (!existingTask || existingTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        const fromStatus = existingTask.status;

        // 如果状态没有变化，只处理排序
        if (fromStatus === newStatus && insertIndex !== undefined) {
          const statusTasks = await ctx.db.task.findMany({
            where: {
              createdById: ctx.session.user.id,
              status: newStatus,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            select: { id: true },
          });

          const currentIndex = statusTasks.findIndex((task) => task.id === id);
          if (currentIndex !== -1 && currentIndex !== insertIndex) {
            const taskIds = statusTasks.map((task) => task.id);
            const reorderedIds = arrayMove(taskIds, currentIndex, insertIndex);

            // 批量更新 sortOrder
            const updatePromises = reorderedIds.map((taskId, index) =>
              ctx.db.task.update({
                where: { id: taskId },
                data: { sortOrder: index },
              }),
            );

            await Promise.all(updatePromises);
          }

          return {
            success: true,
            message: `任务 "${existingTask.title}" 位置已更新`,
          };
        }

        // 处理状态变更
        const updateData: any = { status: newStatus };

        // 如果状态变为已完成，记录完成时间并增加完成次数
        if (newStatus === TaskStatus.DONE) {
          updateData.completedAt = new Date();
          updateData.completedCount = { increment: 1 };
          updateData.isTimerActive = false;
          updateData.timerStartedAt = null;
        }

        // 如果从已完成状态变为其他状态，清除完成时间
        if (fromStatus === TaskStatus.DONE && newStatus !== TaskStatus.DONE) {
          updateData.completedAt = null;
        }

        // 获取目标状态的任务列表以确定 sortOrder
        if (insertIndex !== undefined) {
          const targetStatusTasks = await ctx.db.task.findMany({
            where: {
              createdById: ctx.session.user.id,
              status: newStatus,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            select: { id: true },
          });

          // 在指定位置插入任务
          const newTaskIds = [...targetStatusTasks.map((t) => t.id)];
          newTaskIds.splice(insertIndex, 0, id);

          // 批量更新所有任务的 sortOrder
          const updatePromises = newTaskIds.map((taskId, index) => {
            if (taskId === id) {
              // 更新当前任务的状态和位置
              return ctx.db.task.update({
                where: { id: taskId },
                data: { ...updateData, sortOrder: index },
              });
            } else {
              // 只更新其他任务的位置
              return ctx.db.task.update({
                where: { id: taskId },
                data: { sortOrder: index },
              });
            }
          });

          await Promise.all(updatePromises);
        } else {
          // 没有指定位置，放到第一位（与新任务创建逻辑保持一致）
          const minSortOrder = await ctx.db.task.findFirst({
            where: {
              createdById: ctx.session.user.id,
              status: newStatus,
            },
            select: { sortOrder: true },
            orderBy: { sortOrder: "asc" },
          });

          updateData.sortOrder = (minSortOrder?.sortOrder ?? 1) - 1;

          await ctx.db.task.update({
            where: { id },
            data: updateData,
          });
        }

        // 创建状态历史记录
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus,
            toStatus: newStatus,
            taskId: id,
            changedById: ctx.session.user.id,
            note: note || "拖拽更新状态和位置",
          },
        });

        return {
          success: true,
          message: `任务 "${existingTask.title}" 状态已更新为 ${newStatus}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新任务状态和位置失败",
          cause: error,
        });
      }
    }),

  // 批量更新任务
  batchUpdate: protectedProcedure
    .input(batchUpdateTasksSchema)
    .mutation(async ({ ctx, input }) => {
      const { taskIds, updates } = input;

      try {
        // 验证所有任务的所有权
        const tasks = await ctx.db.task.findMany({
          where: {
            id: { in: taskIds },
            createdById: ctx.session.user.id,
          },
          select: { id: true, title: true, status: true },
        });

        if (tasks.length !== taskIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分任务不存在或无权限修改",
          });
        }

        // 准备更新数据
        const updateData: any = {};

        if (updates.status !== undefined) {
          updateData.status = updates.status;

          // 如果状态变为已完成，记录完成时间
          if (updates.status === TaskStatus.DONE) {
            updateData.completedAt = new Date();
            updateData.completedCount = { increment: 1 };
            updateData.isTimerActive = false;
            updateData.timerStartedAt = null;
          }

          // 如果从已完成状态变为其他状态，清除完成时间
          if (updates.status !== TaskStatus.DONE) {
            updateData.completedAt = null;
          }
        }

        if (updates.priority !== undefined) {
          updateData.priority = updates.priority;
        }

        if (updates.projectId !== undefined) {
          updateData.projectId = updates.projectId;
        }

        // 批量更新任务
        const updatedTasks = await ctx.db.task.updateMany({
          where: {
            id: { in: taskIds },
            createdById: ctx.session.user.id,
          },
          data: updateData,
        });

        // 如果状态发生了变化，为每个任务创建状态历史记录
        if (updates.status !== undefined) {
          const statusHistoryData = tasks.map((task) => ({
            fromStatus: task.status,
            toStatus: updates.status!,
            taskId: task.id,
            changedById: ctx.session.user.id,
            note: "批量状态更新",
          }));

          await ctx.db.taskStatusHistory.createMany({
            data: statusHistoryData,
          });
        }

        // 处理标签更新（如果需要）
        if (updates.tagIds !== undefined) {
          // 先删除所有选中任务的现有标签关联
          await ctx.db.taskTag.deleteMany({
            where: {
              taskId: { in: taskIds },
            },
          });

          // 为每个任务创建新的标签关联
          if (updates.tagIds.length > 0) {
            const tagRelations = taskIds.flatMap((taskId) =>
              updates.tagIds!.map((tagId, index) => ({
                taskId,
                tagId,
                sortOrder: index,
              })),
            );

            await ctx.db.taskTag.createMany({
              data: tagRelations,
            });
          }
        }

        return {
          success: true,
          message: `成功更新 ${updatedTasks.count} 个任务`,
          updatedCount: updatedTasks.count,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量更新任务失败",
          cause: error,
        });
      }
    }),

  // 批量删除任务
  batchDelete: protectedProcedure
    .input(batchDeleteTasksSchema)
    .mutation(async ({ ctx, input }) => {
      const { taskIds } = input;

      try {
        // 验证所有任务的所有权
        const tasks = await ctx.db.task.findMany({
          where: {
            id: { in: taskIds },
            createdById: ctx.session.user.id,
          },
          select: { id: true, title: true },
        });

        if (tasks.length !== taskIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分任务不存在或无权限删除",
          });
        }

        // 批量删除任务（级联删除相关数据）
        const deletedTasks = await ctx.db.task.deleteMany({
          where: {
            id: { in: taskIds },
            createdById: ctx.session.user.id,
          },
        });

        return {
          success: true,
          message: `成功删除 ${deletedTasks.count} 个任务`,
          deletedCount: deletedTasks.count,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量删除任务失败",
          cause: error,
        });
      }
    }),

  // 更新任务反馈
  updateFeedback: protectedProcedure
    .input(updateTaskFeedbackSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...feedbackData } = input;

      try {
        // 验证任务所有权
        const existingTask = await ctx.db.task.findUnique({
          where: { id },
          select: { createdById: true, title: true, status: true },
        });

        if (!existingTask || existingTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        // 更新任务反馈
        const task = await ctx.db.task.update({
          where: { id },
          data: feedbackData,
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        return {
          success: true,
          message: `任务 "${existingTask.title}" 反馈已保存`,
          task,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "保存任务反馈失败",
          cause: error,
        });
      }
    }),

  // 获取任务反馈
  getFeedback: protectedProcedure
    .input(taskIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const task = await ctx.db.task.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            title: true,
            feedback: true,
            createdById: true,
          },
        });

        if (!task || task.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限访问",
          });
        }

        return task;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取任务反馈失败",
          cause: error,
        });
      }
    }),

  // 延期任务
  postponeTask: protectedProcedure
    .input(postponeTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, dueDate, dueTime, note } = input;

      try {
        // 验证任务所有权和类型
        const existingTask = await ctx.db.task.findUnique({
          where: { id },
          select: {
            createdById: true,
            title: true,
            dueDate: true,
            dueTime: true,
            type: true,
            status: true,
          },
        });

        if (!existingTask || existingTask.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或无权限修改",
          });
        }

        // 只有限时任务才能延期
        if (existingTask.type !== TaskType.DEADLINE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "只有限时任务才能延期",
          });
        }

        // 只有待办、进行中、等待中的任务才能延期
        const allowedStatuses: TaskStatus[] = [
          TaskStatus.TODO,
          TaskStatus.IN_PROGRESS,
          TaskStatus.WAITING,
        ];
        if (!allowedStatuses.includes(existingTask.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "只有待办、进行中、等待中的任务才能延期",
          });
        }

        // 更新任务截止时间
        const task = await ctx.db.task.update({
          where: { id },
          data: {
            dueDate,
            dueTime,
          },
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        // 判断是延期还是提前
        const oldDateTime = existingTask.dueDate
          ? new Date(existingTask.dueDate)
          : null;
        if (oldDateTime && existingTask.dueTime) {
          const [hours, minutes] = existingTask.dueTime.split(":");
          oldDateTime.setHours(
            parseInt(hours || "0"),
            parseInt(minutes || "0"),
            0,
            0,
          );
        }

        const newDateTime = new Date(dueDate);
        if (dueTime) {
          const [hours, minutes] = dueTime.split(":");
          newDateTime.setHours(
            parseInt(hours || "0"),
            parseInt(minutes || "0"),
            0,
            0,
          );
        }

        const isAdvance = oldDateTime && newDateTime < oldDateTime;
        const actionText = isAdvance ? "提前" : "延期";

        // 记录时间调整操作到状态历史
        await ctx.db.taskStatusHistory.create({
          data: {
            fromStatus: existingTask.status,
            toStatus: existingTask.status,
            taskId: id,
            changedById: ctx.session.user.id,
            note:
              note ||
              `任务${actionText}至 ${dueDate.toLocaleDateString("zh-CN")}${dueTime ? ` ${dueTime}` : ""}`,
          },
        });

        const oldDateText = existingTask.dueDate
          ? `${existingTask.dueDate.toLocaleDateString("zh-CN")}${existingTask.dueTime ? ` ${existingTask.dueTime}` : ""}`
          : "无截止时间";

        const newDateText = `${dueDate.toLocaleDateString("zh-CN")}${dueTime ? ` ${dueTime}` : ""}`;

        return {
          success: true,
          message: `任务 "${existingTask.title}" 时间已调整\n从 ${oldDateText} ${actionText}至 ${newDateText}`,
          task,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "调整任务时间失败",
          cause: error,
        });
      }
    }),
});

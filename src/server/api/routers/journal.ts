import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createJournalSchema,
  getJournalByDateSchema,
  getJournalsSchema,
  getJournalStatsSchema,
  getJournalTimelineSchema,
  journalIdSchema,
  searchJournalsSchema,
  updateJournalSchema,
  autoGenerateJournalSchema,
} from "@/server/api/schemas/journal";

export const journalRouter = createTRPCRouter({
  // 创建日记
  create: protectedProcedure
    .input(createJournalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 标准化日期为当天的开始时间，确保一致性
        const normalizedDate = new Date(input.date);
        normalizedDate.setHours(0, 0, 0, 0);

        // 检查该日期是否已有日记（使用日期范围查询）
        const startOfDay = new Date(normalizedDate);
        const endOfDay = new Date(normalizedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingJournal = await ctx.db.journal.findFirst({
          where: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
            createdById: ctx.session.user.id,
          },
        });

        if (existingJournal) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "该日期已有日记记录，请使用更新功能",
          });
        }

        // 创建日记
        const journal = await ctx.db.journal.create({
          data: {
            ...input,
            date: normalizedDate, // 使用标准化的日期
            createdById: ctx.session.user.id,
          },
        });

        return journal;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建日记失败",
          cause: error,
        });
      }
    }),

  // 根据日期获取日记
  getByDate: protectedProcedure
    .input(getJournalByDateSchema)
    .query(async ({ ctx, input }) => {
      try {
        // 将日期标准化为当天的开始和结束时间，避免时分秒差异导致的查询问题
        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);

        const journal = await ctx.db.journal.findFirst({
          where: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
            createdById: ctx.session.user.id,
          },
        });

        return journal;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取日记失败",
          cause: error,
        });
      }
    }),

  // 获取日记列表
  getAll: protectedProcedure
    .input(getJournalsSchema)
    .query(async ({ ctx, input }) => {
      const {
        limit,
        cursor,
        search,
        sortBy = "date",
        sortOrder,
        startDate,
        endDate,
        template,
      } = input;

      try {
        const where: any = {
          createdById: ctx.session.user.id,
        };

        // 日期范围筛选
        if (startDate || endDate) {
          where.date = {};
          if (startDate) {
            where.date.gte = startDate;
          }
          if (endDate) {
            where.date.lte = endDate;
          }
        }

        // 模板筛选
        if (template) {
          where.template = template;
        }

        // 搜索筛选
        if (search) {
          where.content = {
            contains: search,
            mode: "insensitive" as const,
          };
        }

        // 获取总数
        const totalCount = await ctx.db.journal.count({ where });

        const journals = await ctx.db.journal.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { [sortBy]: sortOrder },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (journals.length > limit) {
          const nextItem = journals.pop();
          nextCursor = nextItem!.id;
        }

        return {
          journals: journals.map((journal) => ({
            ...journal,
            preview:
              journal.content.substring(0, 150) +
              (journal.content.length > 150 ? "..." : ""),
            wordCount: journal.content.length,
          })),
          nextCursor,
          totalCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取日记列表失败",
          cause: error,
        });
      }
    }),

  // 根据ID获取日记详情
  getById: protectedProcedure
    .input(journalIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const journal = await ctx.db.journal.findUnique({
          where: { id: input.id },
        });

        if (!journal || journal.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "日记不存在或无权限访问",
          });
        }

        return journal;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取日记详情失败",
          cause: error,
        });
      }
    }),

  // 更新日记
  update: protectedProcedure
    .input(updateJournalSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      try {
        // 验证日记所有权
        const existingJournal = await ctx.db.journal.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (
          !existingJournal ||
          existingJournal.createdById !== ctx.session.user.id
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "日记不存在或无权限修改",
          });
        }

        // 更新日记
        const journal = await ctx.db.journal.update({
          where: { id },
          data: updateData,
        });

        return journal;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新日记失败",
          cause: error,
        });
      }
    }),

  // 删除日记
  delete: protectedProcedure
    .input(journalIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证日记所有权
        const journal = await ctx.db.journal.findUnique({
          where: { id: input.id },
          select: { createdById: true, date: true },
        });

        if (!journal || journal.createdById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "日记不存在或无权限删除",
          });
        }

        // 删除日记
        await ctx.db.journal.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: `${journal.date.toLocaleDateString()} 的日志已删除`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "删除日记失败",
          cause: error,
        });
      }
    }),

  // 创建或更新日记（upsert）
  upsert: protectedProcedure
    .input(createJournalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 标准化日期为当天的开始时间，确保一致性
        const normalizedDate = new Date(input.date);
        normalizedDate.setHours(0, 0, 0, 0);

        // 使用 upsert 操作
        const journal = await ctx.db.journal.upsert({
          where: {
            date_createdById: {
              date: normalizedDate,
              createdById: ctx.session.user.id,
            },
          },
          update: {
            content: input.content,
            template: input.template,
          },
          create: {
            ...input,
            date: normalizedDate, // 使用标准化的日期
            createdById: ctx.session.user.id,
          },
        });

        return journal;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "保存日记失败",
          cause: error,
        });
      }
    }),

  // 搜索日记
  search: protectedProcedure
    .input(searchJournalsSchema)
    .query(async ({ ctx, input }) => {
      const { query, limit, cursor, startDate, endDate } = input;

      try {
        const where: any = {
          createdById: ctx.session.user.id,
          content: {
            contains: query,
            mode: "insensitive" as const,
          },
        };

        // 日期范围筛选
        if (startDate || endDate) {
          where.date = {};
          if (startDate) {
            where.date.gte = startDate;
          }
          if (endDate) {
            where.date.lte = endDate;
          }
        }

        const journals = await ctx.db.journal.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { date: "desc" },
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (journals.length > limit) {
          const nextItem = journals.pop();
          nextCursor = nextItem!.id;
        }

        return {
          journals,
          nextCursor,
          total: journals.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "搜索日记失败",
          cause: error,
        });
      }
    }),

  // 获取日记统计
  getStats: protectedProcedure
    .input(getJournalStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          createdById: ctx.session.user.id,
        };

        if (input.startDate || input.endDate) {
          where.date = {};
          if (input.startDate) {
            where.date.gte = input.startDate;
          }
          if (input.endDate) {
            where.date.lte = input.endDate;
          }
        }

        const [totalJournals, , templatesUsed] = await Promise.all([
          ctx.db.journal.count({ where }),
          // 移除不支持的 aggregate 操作
          Promise.resolve(0),
          ctx.db.journal.groupBy({
            by: ["template"],
            where: {
              ...where,
              template: { not: null },
            },
            _count: { template: true },
          }),
        ]);

        // 计算总字数（简单估算）
        const journals = await ctx.db.journal.findMany({
          where,
          select: { content: true },
        });
        const totalWordsCount = journals.reduce((sum, journal) => {
          return sum + journal.content.length;
        }, 0);

        // 计算连续记录天数
        const recentJournals = await ctx.db.journal.findMany({
          where: { createdById: ctx.session.user.id },
          orderBy: { date: "desc" },
          take: 365, // 最多查看一年
          select: { date: true },
        });

        let consecutiveDays = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < recentJournals.length; i++) {
          const journalDate = new Date(recentJournals[i]!.date);
          journalDate.setHours(0, 0, 0, 0);

          const expectedDate = new Date(today);
          expectedDate.setDate(today.getDate() - i);

          if (journalDate.getTime() === expectedDate.getTime()) {
            consecutiveDays++;
          } else {
            break;
          }
        }

        return {
          totalJournals,
          totalWords: totalWordsCount,
          consecutiveDays,
          templatesUsed: templatesUsed.reduce(
            (acc, item) => {
              if (item.template) {
                acc[item.template] = item._count.template;
              }
              return acc;
            },
            {} as Record<string, number>,
          ),
          averageWordsPerJournal:
            totalJournals > 0 ? Math.round(totalWordsCount / totalJournals) : 0,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取日记统计失败",
          cause: error,
        });
      }
    }),

  // 获取日记时间线
  getTimeline: protectedProcedure
    .input(getJournalTimelineSchema)
    .query(async ({ ctx, input }) => {
      try {
        const startDate = new Date(
          input.year,
          input.month ? input.month - 1 : 0,
          1,
        );
        const endDate = new Date(input.year, input.month ?? 12, 0);

        const journals = await ctx.db.journal.findMany({
          where: {
            createdById: ctx.session.user.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            template: true,
            content: true,
          },
        });

        // 按日期组织数据
        const timeline = journals.map((journal) => ({
          id: journal.id,
          date: journal.date,
          template: journal.template,
          preview:
            journal.content.substring(0, 200) +
            (journal.content.length > 200 ? "..." : ""),
          wordCount: journal.content.length,
        }));

        // 生成日历数据（显示哪些日期有日记）
        const calendar: Record<string, boolean> = {};
        journals.forEach((journal) => {
          const dateKey = journal.date.toISOString().split("T")[0];
          calendar[dateKey!] = true;
        });

        return {
          timeline,
          calendar,
          totalDays: journals.length,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取日记时间线失败",
          cause: error,
        });
      }
    }),

  // 获取最近的日记
  getRecent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const journals = await ctx.db.journal.findMany({
          where: { createdById: ctx.session.user.id },
          orderBy: { date: "desc" },
          take: input.limit,
          select: {
            id: true,
            date: true,
            template: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return journals.map((journal) => ({
          ...journal,
          preview:
            journal.content.substring(0, 150) +
            (journal.content.length > 150 ? "..." : ""),
          wordCount: journal.content.length,
        }));
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取最近日记失败",
          cause: error,
        });
      }
    }),

  // 获取日记模板使用统计
  getTemplateStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const templateStats = await ctx.db.journal.groupBy({
        by: ["template"],
        where: {
          createdById: ctx.session.user.id,
          template: { not: null },
        },
        _count: { template: true },
        orderBy: { _count: { template: "desc" } },
      });

      return templateStats.map((stat) => ({
        template: stat.template,
        count: stat._count.template,
      }));
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取模板统计失败",
        cause: error,
      });
    }
  }),

  // 获取写作习惯分析
  getWritingHabits: protectedProcedure
    .input(
      z.object({
        days: z.number().min(7).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        const journals = await ctx.db.journal.findMany({
          where: {
            createdById: ctx.session.user.id,
            date: { gte: startDate },
          },
          orderBy: { date: "asc" },
          select: {
            date: true,
            content: true,
            createdAt: true,
          },
        });

        // 分析写作时间习惯
        const writingTimes: Record<number, number> = {};
        const dailyWordCounts: Record<string, number> = {};
        const weeklyPattern: Record<number, number> = {}; // 0=Sunday, 6=Saturday

        journals.forEach((journal) => {
          const hour = journal.createdAt.getHours();
          const dayOfWeek = journal.date.getDay();
          const dateKey = journal.date.toISOString().split("T")[0]!;

          writingTimes[hour] = (writingTimes[hour] ?? 0) + 1;
          weeklyPattern[dayOfWeek] = (weeklyPattern[dayOfWeek] ?? 0) + 1;
          dailyWordCounts[dateKey] = journal.content.length;
        });

        // 计算平均字数
        const totalWords = Object.values(dailyWordCounts).reduce(
          (sum, count) => sum + count,
          0,
        );
        const averageWords =
          journals.length > 0 ? Math.round(totalWords / journals.length) : 0;

        // 找出最活跃的写作时间
        const mostActiveHour = Object.entries(writingTimes).reduce(
          (max, [hour, count]) => {
            return count > max.count ? { hour: parseInt(hour), count } : max;
          },
          { hour: 0, count: 0 },
        );

        // 找出最活跃的写作日
        const mostActiveDay = Object.entries(weeklyPattern).reduce(
          (max, [day, count]) => {
            return count > max.count ? { day: parseInt(day), count } : max;
          },
          { day: 0, count: 0 },
        );

        return {
          totalEntries: journals.length,
          averageWords,
          totalWords,
          writingTimes,
          weeklyPattern,
          mostActiveHour: mostActiveHour.hour,
          mostActiveDay: mostActiveDay.day,
          consistency: journals.length / input.days, // 写作一致性（每天平均条目数）
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取写作习惯分析失败",
          cause: error,
        });
      }
    }),

  // 批量删除日记
  batchDelete: protectedProcedure
    .input(
      z.object({
        journalIds: z
          .array(z.string().cuid("无效的日志ID"))
          .min(1, "至少选择一个日志"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证所有日记的所有权
        const journals = await ctx.db.journal.findMany({
          where: {
            id: { in: input.journalIds },
            createdById: ctx.session.user.id,
          },
          select: { id: true, date: true },
        });

        if (journals.length !== input.journalIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "部分日记不存在或无权限操作",
          });
        }

        // 批量删除
        await ctx.db.journal.deleteMany({
          where: { id: { in: input.journalIds } },
        });

        return {
          success: true,
          message: `已删除 ${journals.length} 篇日志`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量删除日记失败",
          cause: error,
        });
      }
    }),

  // 自动生成日记（基于当天完成的任务）
  autoGenerate: protectedProcedure
    .input(autoGenerateJournalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 确定目标日期
        const targetDate = input.date || new Date();
        const normalizedDate = new Date(targetDate);
        normalizedDate.setHours(0, 0, 0, 0);

        // 获取当天完成的任务
        const startOfDay = new Date(normalizedDate);
        const endOfDay = new Date(normalizedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const completedTasks = await ctx.db.task.findMany({
          where: {
            createdById: ctx.session.user.id,
            completedAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            type: true,
            feedback: true,
            totalTimeSpent: true,
            project: {
              select: {
                name: true,
              },
            },
            tags: {
              select: {
                tag: {
                  select: {
                    name: true,
                    color: true,
                  },
                },
              },
            },
          },
          orderBy: {
            completedAt: "asc",
          },
        });

        // 如果没有完成的任务，不生成日记
        if (completedTasks.length === 0) {
          return {
            success: false,
            message: "当天没有完成的任务，无需生成日记",
          };
        }

        // 生成默认模板内容
        const year = normalizedDate.getFullYear();
        const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
        const day = String(normalizedDate.getDate()).padStart(2, "0");

        // 构建今日完成任务列表（使用已完成的复选框语法）
        const completedTasksList = completedTasks
          .map((task) => {
            let taskLine = `- [x] **${task.title}**`;

            // 添加项目信息
            if (task.project?.name) {
              taskLine += ` (${task.project.name})`;
            }

            // 添加优先级
            if (task.priority) {
              const priorityMap = {
                LOW: "低",
                MEDIUM: "中",
                HIGH: "高",
                URGENT: "紧急",
              };
              taskLine += ` [${priorityMap[task.priority] || task.priority}]`;
            }

            // 添加任务类型
            if (task.type) {
              const typeMap = {
                NORMAL: "普通",
                DEADLINE: "限时",
              };
              taskLine += ` [${typeMap[task.type] || task.type}]`;
            }

            // 添加耗时信息
            if (task.totalTimeSpent > 0) {
              const hours = Math.floor(task.totalTimeSpent / 3600);
              const minutes = Math.floor((task.totalTimeSpent % 3600) / 60);
              if (hours > 0) {
                taskLine += ` [耗时: ${hours}h${minutes}m]`;
              } else if (minutes > 0) {
                taskLine += ` [耗时: ${minutes}m]`;
              }
            }

            // 添加标签
            if (task.tags && task.tags.length > 0) {
              const tagNames = task.tags.map((t) => t.tag.name).join(", ");
              taskLine += ` #${tagNames}`;
            }

            // 添加描述（如果有，否则使用占位符）
            if (task.description) {
              taskLine += `\n  > ${task.description}`;
            } else {
              taskLine += `\n  > _暂无描述_`;
            }

            // 添加反馈（如果有，否则使用占位符）
            if (task.feedback) {
              taskLine += `\n  💭 ${task.feedback}`;
            } else {
              taskLine += `\n  💭 _暂无反馈_`;
            }

            return taskLine;
          })
          .join("\n\n");

        const templateContent = `# ${year}-${month}-${day} 日记

## 今日完成
${completedTasksList}

## 今日学习
-

## 心得感悟
-

## 遇到的问题
-

## 明日计划
- `;

        // 检查当天是否已有日记
        const existingJournal = await ctx.db.journal.findFirst({
          where: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
            createdById: ctx.session.user.id,
          },
        });

        let journal;
        if (existingJournal) {
          // 更新现有日记，在"今日完成"部分追加任务（去重）
          const existingContent = existingJournal.content;

          // 查找"今日完成"部分
          const completedSectionRegex = /## 今日完成\n([\s\S]*?)(?=\n## |$)/;
          const match = completedSectionRegex.exec(existingContent);

          let updatedContent;
          if (match) {
            // 如果找到"今日完成"部分，进行去重合并
            const existingTasksText = match[1]?.trim() || "";

            // 提取现有任务的标题（用于去重）
            const existingTaskTitles = new Set<string>();
            const existingTaskLines = existingTasksText
              .split("\n")
              .filter((line) => line.trim());
            existingTaskLines.forEach((line) => {
              // 匹配任务行：- [x] **任务标题** 或 - [x] 任务标题 或 - 任务标题
              const taskMatch =
                /^-\s*(?:\[x\]\s*)?(?:\*\*)?(.+?)(?:\*\*)?(?:\s*\([^)]+\))?(?:\s*\[[^\]]+\])?(?:\s*#.*)?$/.exec(
                  line,
                );
              if (taskMatch?.[1]) {
                existingTaskTitles.add(taskMatch[1].trim());
              }
            });

            // 过滤出新的任务（去重）
            const newTasks = completedTasks.filter(
              (task) => !existingTaskTitles.has(task.title),
            );

            if (newTasks.length > 0) {
              // 构建新任务列表（使用相同的格式化逻辑）
              const newTasksList = newTasks
                .map((task) => {
                  let taskLine = `- [x] **${task.title}**`;

                  // 添加项目信息
                  if (task.project?.name) {
                    taskLine += ` (${task.project.name})`;
                  }

                  // 添加优先级
                  if (task.priority) {
                    const priorityMap = {
                      LOW: "低",
                      MEDIUM: "中",
                      HIGH: "高",
                      URGENT: "紧急",
                    };
                    taskLine += ` [${priorityMap[task.priority] || task.priority}]`;
                  }

                  // 添加任务类型
                  if (task.type) {
                    const typeMap = {
                      NORMAL: "普通",
                      DEADLINE: "限时",
                    };
                    taskLine += ` [${typeMap[task.type] || task.type}]`;
                  }

                  // 添加耗时信息
                  if (task.totalTimeSpent > 0) {
                    const hours = Math.floor(task.totalTimeSpent / 3600);
                    const minutes = Math.floor(
                      (task.totalTimeSpent % 3600) / 60,
                    );
                    if (hours > 0) {
                      taskLine += ` [耗时: ${hours}h${minutes}m]`;
                    } else if (minutes > 0) {
                      taskLine += ` [耗时: ${minutes}m]`;
                    }
                  }

                  // 添加标签
                  if (task.tags && task.tags.length > 0) {
                    const tagNames = task.tags
                      .map((t) => t.tag.name)
                      .join(", ");
                    taskLine += ` #${tagNames}`;
                  }

                  // 添加描述（如果有，否则使用占位符）
                  if (task.description) {
                    taskLine += `\n  > ${task.description}`;
                  } else {
                    taskLine += `\n  > _暂无描述_`;
                  }

                  // 添加反馈（如果有，否则使用占位符）
                  if (task.feedback) {
                    taskLine += `\n  💭 ${task.feedback}`;
                  } else {
                    taskLine += `\n  💭 _暂无反馈_`;
                  }

                  return taskLine;
                })
                .join("\n\n");

              const newTasksSection = existingTasksText
                ? `${existingTasksText}\n${newTasksList}`
                : newTasksList;

              updatedContent = existingContent.replace(
                completedSectionRegex,
                `## 今日完成\n${newTasksSection}\n`,
              );
            } else {
              // 没有新任务，不更新内容
              updatedContent = existingContent;
            }
          } else {
            // 如果没有找到"今日完成"部分，在开头添加
            updatedContent = `## 今日完成\n${completedTasksList}\n\n${existingContent}`;
          }

          // 只有在内容有变化时才更新
          if (updatedContent !== existingContent) {
            journal = await ctx.db.journal.update({
              where: { id: existingJournal.id },
              data: {
                content: updatedContent,
                template: input.templateName,
              },
            });

            // 计算实际添加的新任务数量（使用相同的去重逻辑）
            const existingTasksText = match ? match[1]?.trim() || "" : "";
            const existingTaskTitles = new Set<string>();
            if (existingTasksText) {
              const existingTaskLines = existingTasksText
                .split("\n")
                .filter((line) => line.trim());
              existingTaskLines.forEach((line) => {
                const taskMatch =
                  /^-\s*(?:\[x\]\s*)?(?:\*\*)?(.+?)(?:\*\*)?(?:\s*\([^)]+\))?(?:\s*\[[^\]]+\])?(?:\s*#.*)?$/.exec(
                    line,
                  );
                if (taskMatch?.[1]) {
                  existingTaskTitles.add(taskMatch[1].trim());
                }
              });
            }
            const newTasksCount = completedTasks.filter(
              (task) => !existingTaskTitles.has(task.title),
            ).length;

            return {
              success: true,
              message: `已更新当天日记，添加了 ${newTasksCount} 个新完成的任务`,
              journal,
            };
          } else {
            return {
              success: true,
              message: "当天日记已包含所有完成的任务，无需更新",
              journal: existingJournal,
            };
          }
        } else {
          // 创建新日记
          journal = await ctx.db.journal.create({
            data: {
              date: normalizedDate,
              content: templateContent,
              template: input.templateName,
              createdById: ctx.session.user.id,
            },
          });

          return {
            success: true,
            message: `已创建新日记，包含 ${completedTasks.length} 个完成的任务`,
            journal,
          };
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "自动生成日记失败",
          cause: error,
        });
      }
    }),
});

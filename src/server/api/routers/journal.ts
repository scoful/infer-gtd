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
import { autoGenerateJournalForUser } from "@/server/services/journal-auto-generator";

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
        // 调用统一的日记生成函数
        const result = await autoGenerateJournalForUser(
          ctx.session.user.id,
          input.date || new Date(),
          false, // 不强制生成，遵循用户设置
          input.templateName || "默认模板",
          true, // 遵循用户的包含信息设置
        );

        // 转换返回格式以保持兼容性
        if (result.success) {
          // 获取生成的日记对象
          const journal = result.journalId ? await ctx.db.journal.findUnique({
            where: { id: result.journalId },
          }) : null;

          return {
            success: true,
            message: result.message,
            journal,
          };
        } else {
          return {
            success: false,
            message: result.message,
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

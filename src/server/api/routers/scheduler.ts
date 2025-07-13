/**
 * 定时任务调度器 API 路由
 * 
 * 功能：
 * 1. 查看调度器状态
 * 2. 手动执行任务
 * 3. 管理任务开关
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc";
import { taskScheduler } from "@/server/services/scheduler";
import { autoGenerateJournalForUser } from "@/server/services/journal-auto-generator";

export const schedulerRouter = createTRPCRouter({
  // 获取调度器状态
  getStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const status = taskScheduler.getTaskStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取调度器状态失败",
        cause: error,
      });
    }
  }),

  // 手动执行日记自动生成任务
  executeJournalGeneration: protectedProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const targetDate = input.date || new Date();
        const result = await autoGenerateJournalForUser(
          ctx.session.user.id,
          targetDate,
          false, // 不强制生成，遵循用户设置
          "手动生成", // 模板名称
        );

        return {
          success: result.success,
          message: result.message,
          journalId: result.journalId,
          tasksCount: result.tasksCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "手动执行日记生成失败",
          cause: error,
        });
      }
    }),

  // 手动执行指定的定时任务
  executeTask: adminProcedure
    .input(
      z.object({
        taskId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const success = await taskScheduler.executeTaskManually(input.taskId);

        if (!success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "任务不存在或执行失败",
          });
        }

        return {
          success: true,
          message: "任务执行成功",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "手动执行任务失败",
          cause: error,
        });
      }
    }),

  // 获取用户定时设置统计
  getUserScheduleStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // 获取所有用户的定时设置
      const users = await ctx.db.user.findMany({
        select: { id: true, email: true, settings: true },
      });

      const scheduleStats: Record<string, number> = {};
      let enabledCount = 0;
      let disabledCount = 0;

      for (const user of users) {
        if (user.settings) {
          try {
            const settings = JSON.parse(user.settings);
            const autoJournalSettings = settings.autoJournalGeneration;

            if (autoJournalSettings?.dailySchedule !== false) {
              enabledCount++;
              const scheduleTime = autoJournalSettings?.scheduleTime || "23:55";
              scheduleStats[scheduleTime] = (scheduleStats[scheduleTime] || 0) + 1;
            } else {
              disabledCount++;
            }
          } catch (error) {
            disabledCount++;
          }
        } else {
          disabledCount++;
        }
      }

      return {
        success: true,
        data: {
          totalUsers: users.length,
          enabledUsers: enabledCount,
          disabledUsers: disabledCount,
          scheduleDistribution: scheduleStats,
          mostCommonTime: Object.entries(scheduleStats).sort(([,a], [,b]) => b - a)[0]?.[0] || "23:55",
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取用户定时设置统计失败",
        cause: error,
      });
    }
  }),
});

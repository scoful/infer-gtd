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
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { taskScheduler } from "@/server/services/scheduler";
import { autoGenerateJournalForUser } from "@/server/services/journal-auto-generator";

export const schedulerRouter = createTRPCRouter({
  // 获取调度器状态
  getStatus: protectedProcedure.query(async ({ ctx }) => {
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
  executeTask: protectedProcedure
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
});

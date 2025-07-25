/**
 * 用户设置 API 路由
 *
 * 功能：
 * 1. 获取用户设置
 * 2. 更新用户设置
 * 3. 重置设置为默认值
 */

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  userSettingsSchema,
  updateUserSettingsSchema,
  getUserSettingsSchema,
  type UserSettings,
} from "@/server/api/schemas/user-settings";

// 默认用户设置
const defaultSettings: UserSettings = {
  role: "user",
  autoJournalGeneration: {
    onTaskComplete: true,
    dailySchedule: true,
    scheduleTime: "23:55",
    templateName: "默认模板",
    includeTimeSpent: true,
    includeTags: true,
    includeProject: true,
  },
  notifications: {
    journalReminder: false,
    reminderTime: "21:00",
    taskDeadlineReminder: true,
    weeklyReview: false,
  },
  ui: {
    theme: "system",
    language: "zh-CN",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
  },
};

export const userSettingsRouter = createTRPCRouter({
  // 获取用户设置
  get: protectedProcedure
    .input(getUserSettingsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          select: { settings: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "用户不存在",
          });
        }

        // 解析用户设置，如果不存在则使用默认设置
        let userSettings: UserSettings = defaultSettings;
        if (user.settings) {
          try {
            const parsedSettings = JSON.parse(user.settings);
            // 合并默认设置和用户设置，确保所有字段都存在
            userSettings = {
              role: parsedSettings.role || defaultSettings.role,
              autoJournalGeneration: {
                ...defaultSettings.autoJournalGeneration,
                ...parsedSettings.autoJournalGeneration,
              },
              notifications: {
                ...defaultSettings.notifications,
                ...parsedSettings.notifications,
              },
              ui: {
                ...defaultSettings.ui,
                ...parsedSettings.ui,
              },
            };
          } catch (error) {
            // 如果解析失败，使用默认设置
            console.warn("解析用户设置失败，使用默认设置:", error);
          }
        }

        // 如果指定了类别，只返回该类别的设置
        if (input?.category) {
          return {
            success: true,
            data: { [input.category]: userSettings[input.category] },
          };
        }

        return {
          success: true,
          data: userSettings,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "获取用户设置失败",
          cause: error,
        });
      }
    }),

  // 更新用户设置
  update: protectedProcedure
    .input(updateUserSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 验证设置数据（部分更新）
        const validatedSettings = userSettingsSchema
          .partial()
          .parse(input.settings);

        // 获取当前设置
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          select: { settings: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "用户不存在",
          });
        }

        // 合并现有设置和新设置
        let currentSettings: UserSettings = defaultSettings;
        if (user.settings) {
          try {
            const parsedSettings = JSON.parse(user.settings);
            currentSettings = {
              role: parsedSettings.role || defaultSettings.role,
              autoJournalGeneration: {
                ...defaultSettings.autoJournalGeneration,
                ...parsedSettings.autoJournalGeneration,
              },
              notifications: {
                ...defaultSettings.notifications,
                ...parsedSettings.notifications,
              },
              ui: {
                ...defaultSettings.ui,
                ...parsedSettings.ui,
              },
            };
          } catch (error) {
            console.warn("解析现有用户设置失败，使用默认设置:", error);
          }
        }

        // 合并新设置，确保role字段被保留
        const updatedSettings: UserSettings = {
          // 保留现有role，除非明确传递了新的role值
          role:
            validatedSettings.role !== undefined
              ? validatedSettings.role
              : currentSettings.role,
          autoJournalGeneration: validatedSettings.autoJournalGeneration
            ? {
                ...currentSettings.autoJournalGeneration,
                ...validatedSettings.autoJournalGeneration,
              }
            : currentSettings.autoJournalGeneration,
          notifications: validatedSettings.notifications
            ? {
                ...currentSettings.notifications,
                ...validatedSettings.notifications,
              }
            : currentSettings.notifications,
          ui: validatedSettings.ui
            ? {
                ...currentSettings.ui,
                ...validatedSettings.ui,
              }
            : currentSettings.ui,
        };

        // 保存到数据库
        await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { settings: JSON.stringify(updatedSettings) },
        });

        return {
          success: true,
          message: "用户设置已更新",
          data: updatedSettings,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新用户设置失败",
          cause: error,
        });
      }
    }),

  // 重置设置为默认值（保留role字段）
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // 获取当前设置以保留role字段
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { settings: true },
      });

      let currentRole = "user";
      if (user?.settings) {
        try {
          const parsedSettings = JSON.parse(user.settings);
          currentRole = parsedSettings.role || "user";
        } catch (error) {
          console.warn("解析现有设置失败，使用默认role");
        }
      }

      // 重置为默认设置但保留role
      const resetSettings = {
        ...defaultSettings,
        role: currentRole, // 保留现有的role
      };

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { settings: JSON.stringify(resetSettings) },
      });

      return {
        success: true,
        message: "用户设置已重置为默认值（保留管理员权限）",
        data: resetSettings,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "重置用户设置失败",
        cause: error,
      });
    }
  }),

  // 获取默认设置
  getDefaults: protectedProcedure.query(() => {
    return {
      success: true,
      data: defaultSettings,
    };
  }),
});

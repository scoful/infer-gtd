/**
 * 管理员设置工具
 *
 * 用于设置用户为管理员角色
 */

import { db } from "@/server/db";

/**
 * 设置用户为管理员
 */
export async function setUserAsAdmin(userEmail: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true, settings: true },
    });

    if (!user) {
      console.error(`用户不存在: ${userEmail}`);
      return false;
    }

    // 解析现有设置
    let settings: any = {
      role: "admin",
      autoJournalGeneration: {
        enabled: true,
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

    if (user.settings) {
      try {
        const existingSettings = JSON.parse(user.settings);
        settings = {
          ...existingSettings,
          role: "admin", // 强制设置为管理员
        };
      } catch {
        console.warn("解析现有设置失败，使用默认设置");
      }
    }

    // 更新用户设置
    await db.user.update({
      where: { id: user.id },
      data: { settings: JSON.stringify(settings) },
    });

    console.log(`用户 ${userEmail} 已设置为管理员`);
    return true;
  } catch (error) {
    console.error("设置管理员失败:", error);
    return false;
  }
}

/**
 * 移除用户的管理员权限
 */
export async function removeUserAdminRole(userEmail: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true, settings: true },
    });

    if (!user) {
      console.error(`用户不存在: ${userEmail}`);
      return false;
    }

    if (!user.settings) {
      console.log(`用户 ${userEmail} 没有设置，无需操作`);
      return true;
    }

    try {
      const settings = JSON.parse(user.settings);
      settings.role = "user"; // 设置为普通用户

      await db.user.update({
        where: { id: user.id },
        data: { settings: JSON.stringify(settings) },
      });

      console.log(`用户 ${userEmail} 的管理员权限已移除`);
      return true;
    } catch (error) {
      console.error("解析设置失败:", error);
      return false;
    }
  } catch (error) {
    console.error("移除管理员权限失败:", error);
    return false;
  }
}

/**
 * 检查用户是否为管理员
 */
export async function checkUserIsAdmin(userEmail: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { settings: true },
    });

    if (!user?.settings) {
      return false;
    }

    const settings = JSON.parse(user.settings);
    return settings.role === "admin";
  } catch (error) {
    console.error("检查管理员权限失败:", error);
    return false;
  }
}

/**
 * 列出所有管理员用户
 */
export async function listAdminUsers(): Promise<
  Array<{ id: string; email: string; name: string }>
> {
  try {
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, settings: true },
    });

    const adminUsers = users.filter((user) => {
      if (!user.settings) return false;
      try {
        const settings = JSON.parse(user.settings);
        return settings.role === "admin";
      } catch {
        return false;
      }
    });

    return adminUsers.map((user) => ({
      id: user.id,
      email: user.email || "",
      name: user.name || "",
    }));
  } catch (error) {
    console.error("列出管理员用户失败:", error);
    return [];
  }
}

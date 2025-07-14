/**
 * 管理员设置脚本
 *
 * 使用方法：
 * node scripts/setup-admin.js <email>
 *
 * 例如：
 * node scripts/setup-admin.js admin@example.com
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function setUserAsAdmin(userEmail) {
  try {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true, settings: true, name: true },
    });

    if (!user) {
      console.error(`❌ 用户不存在: ${userEmail}`);
      console.log("请确保用户已经通过OAuth登录过系统");
      return false;
    }

    // 解析现有设置
    let settings = {
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
      } catch (error) {
        console.warn("⚠️  解析现有设置失败，使用默认设置");
      }
    }

    // 更新用户设置
    await db.user.update({
      where: { id: user.id },
      data: { settings: JSON.stringify(settings) },
    });

    console.log(
      `✅ 用户 ${user.name || userEmail} (${userEmail}) 已设置为管理员`,
    );
    return true;
  } catch (error) {
    console.error("❌ 设置管理员失败:", error);
    return false;
  }
}

async function listAdminUsers() {
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

    if (adminUsers.length === 0) {
      console.log("📋 当前没有管理员用户");
    } else {
      console.log("📋 当前管理员用户列表:");
      adminUsers.forEach((user) => {
        console.log(`  - ${user.name || "未设置姓名"} (${user.email})`);
      });
    }

    return adminUsers;
  } catch (error) {
    console.error("❌ 列出管理员用户失败:", error);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("📖 管理员设置脚本");
    console.log("");
    console.log("使用方法:");
    console.log("  node scripts/setup-admin.js <email>     # 设置用户为管理员");
    console.log("  node scripts/setup-admin.js --list      # 列出所有管理员");
    console.log("");
    console.log("例如:");
    console.log("  node scripts/setup-admin.js admin@example.com");
    console.log("  node scripts/setup-admin.js --list");
    return;
  }

  if (args[0] === "--list") {
    await listAdminUsers();
    return;
  }

  const email = args[0];

  // 简单的邮箱格式验证
  if (!email.includes("@")) {
    console.error("❌ 请提供有效的邮箱地址");
    return;
  }

  console.log(`🔧 正在设置 ${email} 为管理员...`);

  const success = await setUserAsAdmin(email);

  if (success) {
    console.log("");
    console.log("🎉 设置完成！用户现在可以访问管理员功能:");
    console.log("  - 定时任务管理: /admin/scheduler");
    console.log("  - 系统设置管理");
    console.log("");
    console.log("📋 当前所有管理员:");
    await listAdminUsers();
  }
}

main()
  .catch((e) => {
    console.error("❌ 脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function quickTest() {
  console.log("⚡ 快速数据库测试...");

  try {
    // 1. 基础连接测试
    console.log("\n🔌 测试数据库连接...");
    await prisma.$connect();
    console.log("✅ 数据库连接成功");

    // 2. 基础数据统计
    console.log("\n📊 数据统计:");
    const [
      userCount,
      projectCount,
      taskCount,
      noteCount,
      journalCount,
      tagCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.note.count(),
      prisma.journal.count(),
      prisma.tag.count(),
    ]);

    console.log(`  - 用户: ${userCount} 个`);
    console.log(`  - 项目: ${projectCount} 个`);
    console.log(`  - 任务: ${taskCount} 个`);
    console.log(`  - 笔记: ${noteCount} 篇`);
    console.log(`  - 日志: ${journalCount} 篇`);
    console.log(`  - 标签: ${tagCount} 个`);

    if (userCount === 0) {
      console.log("\n⚠️ 没有找到用户数据，请运行种子数据脚本:");
      console.log("   pnpm db:seed");
      return;
    }

    // 3. 测试基础查询
    console.log("\n🔍 测试基础查询...");

    const firstUser = await prisma.user.findFirst({
      include: {
        projects: true,
        tasks: true,
        notes: true,
        journals: true,
      },
    });

    if (firstUser) {
      console.log(`✅ 用户 "${firstUser.name}" 的数据:`);
      console.log(`  - 项目: ${firstUser.projects.length} 个`);
      console.log(`  - 任务: ${firstUser.tasks.length} 个`);
      console.log(`  - 笔记: ${firstUser.notes.length} 篇`);
      console.log(`  - 日志: ${firstUser.journals.length} 篇`);
    }

    // 4. 测试关联查询
    console.log("\n🔗 测试关联查询...");

    const taskWithRelations = await prisma.task.findFirst({
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
        timeEntries: true,
        statusHistory: true,
      },
    });

    if (taskWithRelations) {
      console.log(`✅ 任务 "${taskWithRelations.title}" 的关联数据:`);
      console.log(`  - 项目: ${taskWithRelations.project?.name || "无"}`);
      console.log(`  - 标签: ${taskWithRelations.tags.length} 个`);
      console.log(`  - 时间记录: ${taskWithRelations.timeEntries.length} 条`);
      console.log(`  - 状态历史: ${taskWithRelations.statusHistory.length} 条`);
    }

    // 5. 测试枚举值
    console.log("\n📋 测试枚举值...");

    const taskStatusCounts = await prisma.task.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    console.log("✅ 任务状态分布:");
    for (const item of taskStatusCounts) {
      console.log(`  - ${item.status}: ${item._count.status} 个`);
    }

    // 6. 测试复杂查询
    console.log("\n🔍 测试复杂查询...");

    const recentTasks = await prisma.task.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
        },
      },
      include: {
        project: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    console.log(`✅ 最近7天创建的任务: ${recentTasks.length} 个`);
    for (const task of recentTasks) {
      console.log(`  - ${task.title} (${task.project?.name || "无项目"})`);
    }

    console.log("\n🎉 所有测试通过！数据库工作正常。");
  } catch (error) {
    console.error("❌ 测试失败:", error);

    if (error instanceof Error) {
      if (error.message.includes("connect")) {
        console.log("\n💡 可能的解决方案:");
        console.log("1. 检查数据库连接字符串 (DATABASE_URL)");
        console.log("2. 确保数据库服务正在运行");
        console.log("3. 检查网络连接");
      } else if (error.message.includes("does not exist")) {
        console.log("\n💡 可能的解决方案:");
        console.log("1. 运行数据库迁移: pnpm prisma db push");
        console.log("2. 或重置数据库: pnpm prisma migrate reset");
      }
    }

    throw error;
  }
}

async function main() {
  await quickTest();
}

main()
  .catch((e) => {
    console.error("❌ 快速测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

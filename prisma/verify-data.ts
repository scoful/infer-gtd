import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyData() {
  console.log("🔍 验证数据库数据...");

  try {
    // 基础数据统计
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.note.count(),
      prisma.journal.count(),
      prisma.tag.count(),
      prisma.timeEntry.count(),
      prisma.taskStatusHistory.count(),
    ]);

    console.log("📊 数据统计:");
    console.log(`  - 用户: ${counts[0]} 个`);
    console.log(`  - 项目: ${counts[1]} 个`);
    console.log(`  - 任务: ${counts[2]} 个`);
    console.log(`  - 笔记: ${counts[3]} 篇`);
    console.log(`  - 日志: ${counts[4]} 篇`);
    console.log(`  - 标签: ${counts[5]} 个`);
    console.log(`  - 时间记录: ${counts[6]} 条`);
    console.log(`  - 状态历史: ${counts[7]} 条`);

    // 验证关联关系
    const userWithData = await prisma.user.findFirst({
      include: {
        projects: true,
        tasks: {
          include: {
            tags: true,
            timeEntries: true,
          },
        },
        notes: true,
        journals: true,
      },
    });

    if (userWithData) {
      console.log(`\n👤 用户 ${userWithData.name} 的关联数据:`);
      console.log(`  - 项目: ${userWithData.projects.length} 个`);
      console.log(`  - 任务: ${userWithData.tasks.length} 个`);
      console.log(`  - 笔记: ${userWithData.notes.length} 篇`);
      console.log(`  - 日志: ${userWithData.journals.length} 篇`);

      // 验证任务状态分布
      const statusCounts = userWithData.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`  - 任务状态分布:`, statusCounts);

      // 验证标签关联
      const tasksWithTags = userWithData.tasks.filter(task => task.tags.length > 0);
      console.log(`  - 有标签的任务: ${tasksWithTags.length} 个`);

      // 验证时间追踪
      const tasksWithTime = userWithData.tasks.filter(task => task.timeEntries.length > 0);
      console.log(`  - 有时间记录的任务: ${tasksWithTime.length} 个`);
    }

    // 验证复杂查询
    const complexQuery = await prisma.task.findMany({
      where: {
        status: "IN_PROGRESS",
      },
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
        timeEntries: true,
      },
    });

    console.log(`\n🔄 进行中的任务: ${complexQuery.length} 个`);
    for (const task of complexQuery) {
      console.log(`  - ${task.title}`);
      console.log(`    项目: ${task.project?.name || "无"}`);
      console.log(`    标签: ${task.tags.map(t => t.tag.name).join(", ") || "无"}`);
      console.log(`    时间记录: ${task.timeEntries.length} 条`);
    }

    console.log("\n✅ 数据验证完成！所有关联关系正常工作。");

  } catch (error) {
    console.error("❌ 数据验证失败:", error);
    throw error;
  }
}

async function main() {
  await verifyData();
}

main()
  .catch((e) => {
    console.error("❌ 验证失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, TaskStatus, TaskType, Priority } from "@prisma/client";

const prisma = new PrismaClient();

async function testBasicScenarios() {
  console.log("🧪 基础场景测试...");

  try {
    // 获取测试用户
    const testUser = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (!testUser) {
      console.log("⚠️ 测试用户不存在，请先运行: pnpm db:seed");
      return;
    }

    console.log(`👤 测试用户: ${testUser.name}`);

    // 测试1: 用户数据查询
    console.log("\n📋 测试1: 用户数据查询");
    const userData = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        projects: true,
        tasks: {
          include: {
            project: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        notes: true,
        journals: true,
      },
    });

    if (userData) {
      console.log(`✅ 用户数据完整性:`);
      console.log(`  - 项目: ${userData.projects.length} 个`);
      console.log(`  - 任务: ${userData.tasks.length} 个`);
      console.log(`  - 笔记: ${userData.notes.length} 篇`);
      console.log(`  - 日志: ${userData.journals.length} 篇`);

      // 任务状态分布
      const statusCounts = userData.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`  - 任务状态:`, statusCounts);
    }

    // 测试2: 项目关联查询
    console.log("\n📋 测试2: 项目关联查询");
    const projectsWithTasks = await prisma.project.findMany({
      where: { createdById: testUser.id },
      include: {
        tasks: true,
        notes: true,
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
    });

    console.log(`✅ 项目数据:`);
    for (const project of projectsWithTasks) {
      console.log(`  - ${project.name}: ${project._count.tasks} 任务, ${project._count.notes} 笔记`);
    }

    // 测试3: 标签关联查询
    console.log("\n📋 测试3: 标签关联查询");
    const tagsWithUsage = await prisma.tag.findMany({
      where: { createdById: testUser.id },
      include: {
        taskTags: {
          include: {
            task: true,
          },
        },
        noteTags: {
          include: {
            note: true,
          },
        },
      },
    });

    console.log(`✅ 标签使用情况:`);
    for (const tag of tagsWithUsage) {
      console.log(`  - ${tag.name}: ${tag.taskTags.length} 任务, ${tag.noteTags.length} 笔记`);
    }

    // 测试4: 时间追踪查询
    console.log("\n📋 测试4: 时间追踪查询");
    const timeEntries = await prisma.timeEntry.findMany({
      where: { createdById: testUser.id },
      include: {
        task: true,
      },
    });

    console.log(`✅ 时间记录: ${timeEntries.length} 条`);
    for (const entry of timeEntries) {
      const duration = entry.duration ? `${(entry.duration / 60).toFixed(0)}分钟` : "进行中";
      console.log(`  - ${entry.task.title}: ${duration}`);
    }

    // 测试5: 状态历史查询
    console.log("\n📋 测试5: 状态历史查询");
    const statusHistory = await prisma.taskStatusHistory.findMany({
      where: { changedById: testUser.id },
      include: {
        task: true,
      },
      orderBy: { changedAt: "desc" },
      take: 5,
    });

    console.log(`✅ 最近状态变更: ${statusHistory.length} 条`);
    for (const history of statusHistory) {
      const fromStatus = history.fromStatus || "新建";
      console.log(`  - ${history.task.title}: ${fromStatus} → ${history.toStatus}`);
    }

    // 测试6: 复杂查询 - 带条件的任务查询
    console.log("\n📋 测试6: 复杂查询");
    const activeTasks = await prisma.task.findMany({
      where: {
        createdById: testUser.id,
        status: {
          in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.WAITING],
        },
      },
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
    });

    console.log(`✅ 活跃任务: ${activeTasks.length} 个`);
    for (const task of activeTasks) {
      const tags = task.tags.map(t => t.tag.name).join(", ");
      console.log(`  - ${task.title} (${task.status}) - 标签: ${tags || "无"}`);
    }

    // 测试7: 日志查询
    console.log("\n📋 测试7: 日志查询");
    const journals = await prisma.journal.findMany({
      where: { createdById: testUser.id },
      orderBy: { date: "desc" },
    });

    console.log(`✅ 日志记录: ${journals.length} 篇`);
    for (const journal of journals) {
      const preview = journal.content.split('\n')[0]?.substring(0, 50) + "...";
      console.log(`  - ${journal.date.toLocaleDateString()}: ${preview}`);
    }

    console.log("\n🎉 所有基础场景测试通过！");

  } catch (error) {
    console.error("❌ 测试失败:", error);
    throw error;
  }
}

async function main() {
  await testBasicScenarios();
}

main()
  .catch((e) => {
    console.error("❌ 基础测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

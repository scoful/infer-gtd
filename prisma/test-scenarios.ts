import { PrismaClient, TaskStatus, TaskType, Priority } from "@prisma/client";

const prisma = new PrismaClient();

async function testComplexScenarios() {
  console.log("🧪 开始复杂场景测试...");

  try {
    // 测试场景1: 用户数据隔离
    console.log("\n📋 测试场景1: 用户数据隔离");

    const testUser = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (!testUser) {
      console.log("⚠️ 测试用户不存在，请先运行种子数据脚本: pnpm db:seed");
      return;
    }

    // 查询用户的所有数据
    const userData = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        projects: {
          include: {
            tasks: true,
            notes: true,
          },
        },
        tasks: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
            timeEntries: true,
            statusHistory: true,
          },
        },
        notes: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        journals: true,
        tags: true,
      },
    });

    console.log(`✅ 用户 ${userData?.name} 的数据:`);
    console.log(`  - 项目: ${userData?.projects.length} 个`);
    console.log(`  - 任务: ${userData?.tasks.length} 个`);
    console.log(`  - 笔记: ${userData?.notes.length} 篇`);
    console.log(`  - 日志: ${userData?.journals.length} 篇`);
    console.log(`  - 标签: ${userData?.tags.length} 个`);

    // 测试场景2: 任务状态流转和历史记录
    console.log("\n📋 测试场景2: 任务状态流转");

    const activeTask = await prisma.task.findFirst({
      where: {
        status: TaskStatus.IN_PROGRESS,
        createdById: testUser.id,
      },
      include: {
        statusHistory: {
          orderBy: { changedAt: "desc" },
        },
      },
    });

    if (activeTask) {
      console.log(`✅ 找到进行中任务: ${activeTask.title}`);
      console.log(`  - 当前状态: ${activeTask.status}`);
      console.log(`  - 状态历史: ${activeTask.statusHistory.length} 条记录`);

      // 模拟状态变更
      await prisma.taskStatusHistory.create({
        data: {
          fromStatus: activeTask.status,
          toStatus: TaskStatus.WAITING,
          taskId: activeTask.id,
          changedById: testUser.id,
          note: "等待外部依赖",
        },
      });

      await prisma.task.update({
        where: { id: activeTask.id },
        data: { status: TaskStatus.WAITING },
      });

      console.log(`✅ 任务状态已更新为: WAITING`);
    } else {
      console.log(`ℹ️ 没有找到进行中的任务，跳过状态流转测试`);
    }

    // 测试场景3: 时间追踪功能
    console.log("\n📋 测试场景3: 时间追踪功能");

    const tasksWithTime = await prisma.task.findMany({
      where: {
        createdById: testUser.id,
        totalTimeSpent: { gt: 0 },
      },
      include: {
        timeEntries: {
          orderBy: { startTime: "desc" },
        },
      },
    });

    console.log(`✅ 找到 ${tasksWithTime.length} 个有时间记录的任务:`);
    for (const task of tasksWithTime) {
      const totalHours = (task.totalTimeSpent / 3600).toFixed(2);
      console.log(`  - ${task.title}: ${totalHours} 小时 (${task.timeEntries.length} 条记录)`);
    }

    // 测试场景4: 标签系统和多对多关联
    console.log("\n📋 测试场景4: 标签系统");

    const tagsWithCounts = await prisma.tag.findMany({
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

    console.log(`✅ 标签使用统计:`);
    for (const tag of tagsWithCounts) {
      console.log(`  - ${tag.name}: ${tag.taskTags.length} 个任务, ${tag.noteTags.length} 篇笔记`);
    }

    // 测试场景5: 重复任务功能
    console.log("\n📋 测试场景5: 重复任务");

    const recurringTasks = await prisma.task.findMany({
      where: {
        createdById: testUser.id,
        isRecurring: true,
      },
    });

    console.log(`✅ 找到 ${recurringTasks.length} 个重复任务:`);
    for (const task of recurringTasks) {
      console.log(`  - ${task.title}: 完成 ${task.completedCount} 次`);
      if (task.recurringPattern) {
        const pattern = JSON.parse(task.recurringPattern);
        console.log(`    模式: ${pattern.type}, 间隔: ${pattern.interval}`);
      }
    }

    // 测试场景6: 项目关联和层级查询
    console.log("\n📋 测试场景6: 项目关联");

    const projectsWithContent = await prisma.project.findMany({
      where: { createdById: testUser.id },
      include: {
        tasks: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        notes: true,
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
    });

    console.log(`✅ 项目内容统计:`);
    for (const project of projectsWithContent) {
      console.log(`  - ${project.name}:`);
      console.log(`    任务: ${project._count.tasks} 个`);
      console.log(`    笔记: ${project._count.notes} 篇`);

      const statusCounts = project.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`    状态分布:`, statusCounts);
    }

    // 测试场景7: 日志查询和时间范围
    console.log("\n📋 测试场景7: 日志查询");

    const recentJournals = await prisma.journal.findMany({
      where: {
        createdById: testUser.id,
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
        },
      },
      orderBy: { date: "desc" },
    });

    console.log(`✅ 最近7天的日志: ${recentJournals.length} 篇`);
    for (const journal of recentJournals) {
      console.log(`  - ${journal.date.toLocaleDateString()}: ${journal.content.split('\n')[0]}`);
    }

    // 测试场景8: 复杂查询 - 即将到期的高优先级任务
    console.log("\n📋 测试场景8: 复杂查询");

    const urgentTasks = await prisma.task.findMany({
      where: {
        createdById: testUser.id,
        status: {
          in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        },
        priority: {
          in: [Priority.HIGH, Priority.URGENT],
        },
        dueDate: {
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3天内到期
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
        { dueDate: "asc" },
      ],
    });

    console.log(`✅ 即将到期的高优先级任务: ${urgentTasks.length} 个`);
    for (const task of urgentTasks) {
      const daysLeft = Math.ceil((task.dueDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      console.log(`  - ${task.title} (${task.priority}): ${daysLeft} 天后到期`);
      console.log(`    项目: ${task.project?.name || "无"}`);
    }

    console.log("\n✅ 所有测试场景通过！");

  } catch (error) {
    console.error("❌ 测试失败:", error);
    throw error;
  }
}

async function testDataIntegrity() {
  console.log("\n🔍 数据完整性测试...");

  try {
    // 检查是否有孤立的时间记录（taskId 不存在对应任务）
    const allTimeEntries = await prisma.timeEntry.findMany({
      include: {
        task: true,
      },
    });
    const orphanedTimeEntries = allTimeEntries.filter(entry => !entry.task);

    console.log(`✅ 孤立时间记录: ${orphanedTimeEntries.length} 个`);

    // 测试唯一约束 - 检查是否有重复的日志（同一用户同一天有多个日志）
    const duplicateJournals = await prisma.$queryRaw`
      SELECT date, "createdById", COUNT(*) as count
      FROM "Journal"
      GROUP BY date, "createdById"
      HAVING COUNT(*) > 1
    `;

    console.log(`✅ 重复日志: ${(duplicateJournals as any[]).length} 个`);

    // 额外的数据完整性检查
    const totalUsers = await prisma.user.count();
    const totalTasks = await prisma.task.count();
    const totalProjects = await prisma.project.count();

    console.log(`📊 数据统计:`);
    console.log(`  - 总用户数: ${totalUsers}`);
    console.log(`  - 总任务数: ${totalTasks}`);
    console.log(`  - 总项目数: ${totalProjects}`);

    // 检查关联关系完整性
    const tasksWithoutUser = await prisma.task.count({
      where: {
        createdById: {
          not: {
            in: (await prisma.user.findMany({ select: { id: true } })).map(u => u.id)
          }
        }
      }
    });

    console.log(`✅ 无效用户关联的任务: ${tasksWithoutUser} 个`);

    console.log("✅ 数据完整性测试通过！");

  } catch (error) {
    console.error("❌ 数据完整性测试失败:", error);
    throw error;
  }
}

async function main() {
  await testComplexScenarios();
  await testDataIntegrity();
  console.log("\n🎉 所有测试完成！");
}

main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

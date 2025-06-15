/**
 * 任务逻辑测试脚本
 * 直接测试任务相关的数据库操作
 */

import { db } from "@/server/db";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

async function testTaskLogic() {
  console.log("🧪 开始测试任务逻辑...");

  try {
    // 获取测试用户
    const testUser = await db.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (!testUser) {
      console.log("⚠️ 测试用户不存在，请先运行: pnpm db:seed");
      return;
    }

    console.log(`👤 使用测试用户: ${testUser.name}`);

    // 测试1: 创建任务
    console.log("\n📋 测试1: 创建任务");
    const newTask = await db.task.create({
      data: {
        title: "逻辑测试任务",
        description: "这是一个测试任务的逻辑功能",
        type: TaskType.ACTION,
        priority: Priority.HIGH,
        status: TaskStatus.IDEA,
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建任务成功: ${newTask.title} (ID: ${newTask.id})`);

    // 创建状态历史记录
    await db.taskStatusHistory.create({
      data: {
        fromStatus: null,
        toStatus: TaskStatus.IDEA,
        taskId: newTask.id,
        changedById: testUser.id,
        note: "任务创建",
      },
    });

    // 测试2: 查询任务
    console.log("\n📋 测试2: 查询任务");
    const tasks = await db.task.findMany({
      where: { createdById: testUser.id },
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log(`✅ 查询任务成功: 找到 ${tasks.length} 个任务`);

    // 测试3: 更新任务状态
    console.log("\n📋 测试3: 更新任务状态");
    const updatedTask = await db.task.update({
      where: { id: newTask.id },
      data: { status: TaskStatus.IN_PROGRESS },
    });

    // 创建状态历史记录
    await db.taskStatusHistory.create({
      data: {
        fromStatus: TaskStatus.IDEA,
        toStatus: TaskStatus.IN_PROGRESS,
        taskId: newTask.id,
        changedById: testUser.id,
        note: "开始处理任务",
      },
    });
    console.log(`✅ 更新状态成功: ${updatedTask.status}`);

    // 测试4: 时间追踪
    console.log("\n📋 测试4: 时间追踪");
    const startTime = new Date();
    
    // 开始计时
    await db.task.update({
      where: { id: newTask.id },
      data: {
        isTimerActive: true,
        timerStartedAt: startTime,
      },
    });

    // 创建时间记录
    const timeEntry = await db.timeEntry.create({
      data: {
        startTime,
        description: "开始工作",
        taskId: newTask.id,
        createdById: testUser.id,
      },
    });
    console.log(`✅ 开始计时成功`);

    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 结束计时
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    await db.timeEntry.update({
      where: { id: timeEntry.id },
      data: {
        endTime,
        duration,
      },
    });

    await db.task.update({
      where: { id: newTask.id },
      data: {
        isTimerActive: false,
        timerStartedAt: null,
        totalTimeSpent: { increment: duration },
      },
    });
    console.log(`✅ 结束计时成功: 用时 ${duration} 秒`);

    // 测试5: 重复任务设置
    console.log("\n📋 测试5: 重复任务设置");
    const recurringPattern = {
      type: "daily",
      interval: 1,
      time: "09:00",
    };

    await db.task.update({
      where: { id: newTask.id },
      data: {
        isRecurring: true,
        recurringPattern: JSON.stringify(recurringPattern),
      },
    });
    console.log(`✅ 设置重复任务成功`);

    // 测试6: 标签关联
    console.log("\n📋 测试6: 标签关联");
    
    // 获取一个标签
    const tag = await db.tag.findFirst({
      where: { createdById: testUser.id },
    });

    if (tag) {
      // 关联标签
      await db.taskTag.create({
        data: {
          taskId: newTask.id,
          tagId: tag.id,
        },
      });
      console.log(`✅ 关联标签成功: ${tag.name}`);
    }

    // 测试7: 复杂查询
    console.log("\n📋 测试7: 复杂查询");
    
    // 查询活跃任务
    const activeTasks = await db.task.findMany({
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
        timeEntries: true,
      },
    });
    console.log(`✅ 活跃任务查询成功: ${activeTasks.length} 个任务`);

    // 测试8: 统计查询
    console.log("\n📋 测试8: 统计查询");
    
    const [totalTasks, completedTasks, totalTimeSpent] = await Promise.all([
      db.task.count({ where: { createdById: testUser.id } }),
      db.task.count({ 
        where: { 
          createdById: testUser.id, 
          status: TaskStatus.DONE 
        } 
      }),
      db.task.aggregate({
        where: { createdById: testUser.id },
        _sum: { totalTimeSpent: true },
      }),
    ]);

    console.log(`✅ 统计查询成功:`);
    console.log(`  - 总任务数: ${totalTasks}`);
    console.log(`  - 已完成: ${completedTasks}`);
    console.log(`  - 完成率: ${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}%`);
    console.log(`  - 总用时: ${totalTimeSpent._sum.totalTimeSpent || 0} 秒`);

    // 测试9: 任务完成
    console.log("\n📋 测试9: 任务完成");
    await db.task.update({
      where: { id: newTask.id },
      data: {
        status: TaskStatus.DONE,
        completedAt: new Date(),
        completedCount: { increment: 1 },
      },
    });

    // 创建状态历史记录
    await db.taskStatusHistory.create({
      data: {
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.DONE,
        taskId: newTask.id,
        changedById: testUser.id,
        note: "任务完成",
      },
    });
    console.log(`✅ 任务完成成功`);

    // 测试10: 清理测试数据
    console.log("\n📋 测试10: 清理测试数据");
    await db.task.delete({
      where: { id: newTask.id },
    });
    console.log(`✅ 清理测试数据成功`);

    console.log("\n🎉 所有任务逻辑测试通过！");

  } catch (error) {
    console.error("❌ 任务逻辑测试失败:", error);
    throw error;
  }
}

async function main() {
  await testTaskLogic();
}

main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

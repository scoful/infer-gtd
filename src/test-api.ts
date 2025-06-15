/**
 * API 测试脚本
 * 用于测试 tRPC API 的功能
 */

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
import { TaskStatus, TaskType, Priority } from "@prisma/client";

async function testTaskAPI() {
  console.log("🧪 开始测试 Task API...");

  try {
    // 获取测试用户
    const testUser = await db.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (!testUser) {
      console.log("⚠️ 测试用户不存在，请先运行: pnpm db:seed");
      return;
    }

    // 创建模拟的 tRPC 上下文
    const ctx = await createTRPCContext({
      headers: new Headers(),
      session: {
        user: {
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
          image: testUser.image,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      db,
    });

    // 创建 API 调用器
    const caller = appRouter.createCaller(ctx);

    // 测试1: 创建任务
    console.log("\n📋 测试1: 创建任务");
    const newTask = await caller.task.create({
      title: "API 测试任务",
      description: "这是一个通过 API 创建的测试任务",
      type: TaskType.ACTION,
      priority: Priority.HIGH,
    });
    console.log(`✅ 创建任务成功: ${newTask.title} (ID: ${newTask.id})`);

    // 测试2: 获取任务列表
    console.log("\n📋 测试2: 获取任务列表");
    const taskList = await caller.task.getAll({
      limit: 10,
    });
    console.log(`✅ 获取任务列表成功: ${taskList.tasks.length} 个任务`);

    // 测试3: 获取任务详情
    console.log("\n📋 测试3: 获取任务详情");
    const taskDetail = await caller.task.getById({ id: newTask.id });
    console.log(`✅ 获取任务详情成功: ${taskDetail.title}`);
    console.log(`  - 状态: ${taskDetail.status}`);
    console.log(`  - 优先级: ${taskDetail.priority}`);
    console.log(`  - 状态历史: ${taskDetail.statusHistory.length} 条`);

    // 测试4: 更新任务状态
    console.log("\n📋 测试4: 更新任务状态");
    const statusUpdate = await caller.task.updateStatus({
      id: newTask.id,
      status: TaskStatus.IN_PROGRESS,
      note: "开始处理任务",
    });
    console.log(`✅ 更新状态成功: ${statusUpdate.message}`);

    // 测试5: 开始计时
    console.log("\n📋 测试5: 开始计时");
    const startTimer = await caller.task.startTimer({
      id: newTask.id,
      description: "开始工作",
    });
    console.log(`✅ 开始计时成功: ${startTimer.message}`);

    // 等待2秒
    console.log("⏱️ 等待2秒...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试6: 暂停计时
    console.log("\n📋 测试6: 暂停计时");
    const pauseTimer = await caller.task.pauseTimer({
      id: newTask.id,
      description: "暂停工作",
    });
    console.log(`✅ 暂停计时成功: ${pauseTimer.message}`);

    // 测试7: 设置重复任务
    console.log("\n📋 测试7: 设置重复任务");
    const setRecurring = await caller.task.setRecurring({
      id: newTask.id,
      isRecurring: true,
      recurringPattern: {
        type: "daily",
        interval: 1,
        time: "09:00",
      },
    });
    console.log(`✅ 设置重复任务成功: ${setRecurring.message}`);

    // 测试8: 获取时间记录
    console.log("\n📋 测试8: 获取时间记录");
    const timeEntries = await caller.task.getTimeEntries({
      taskId: newTask.id,
      limit: 10,
    });
    console.log(`✅ 获取时间记录成功: ${timeEntries.length} 条记录`);
    if (timeEntries.length > 0) {
      const entry = timeEntries[0];
      console.log(`  - 最新记录: ${entry?.description || "无描述"}`);
      console.log(`  - 时长: ${entry?.duration ? `${entry.duration}秒` : "进行中"}`);
    }

    // 测试9: 获取任务统计
    console.log("\n📋 测试9: 获取任务统计");
    const stats = await caller.task.getStats({});
    console.log(`✅ 获取统计成功:`);
    console.log(`  - 总任务数: ${stats.totalTasks}`);
    console.log(`  - 已完成: ${stats.completedTasks}`);
    console.log(`  - 完成率: ${stats.completionRate}%`);
    console.log(`  - 总用时: ${stats.totalTimeSpent}秒`);
    console.log(`  - 状态分布:`, stats.statusCounts);

    // 测试10: 更新任务
    console.log("\n📋 测试10: 更新任务");
    const updatedTask = await caller.task.update({
      id: newTask.id,
      title: "API 测试任务 (已更新)",
      description: "这是一个更新后的测试任务",
      priority: Priority.MEDIUM,
    });
    console.log(`✅ 更新任务成功: ${updatedTask.title}`);

    // 测试11: 归档任务
    console.log("\n📋 测试11: 归档任务");
    const archiveTask = await caller.task.archiveTask({
      id: newTask.id,
      note: "测试完成，归档任务",
    });
    console.log(`✅ 归档任务成功: ${archiveTask.message}`);

    console.log("\n🎉 所有 Task API 测试通过！");

  } catch (error) {
    console.error("❌ API 测试失败:", error);
    if (error instanceof Error) {
      console.error("错误详情:", error.message);
    }
    throw error;
  }
}

async function main() {
  await testTaskAPI();
}

main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

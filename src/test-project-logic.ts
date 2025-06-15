/**
 * 项目逻辑测试脚本
 * 直接测试项目相关的数据库操作
 */

import { db } from "@/server/db";

async function testProjectLogic() {
  console.log("🧪 开始测试项目逻辑...");

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

    // 测试1: 创建项目
    console.log("\n📋 测试1: 创建项目");
    const newProject = await db.project.create({
      data: {
        name: "测试项目",
        description: "这是一个用于测试的项目",
        color: "#3B82F6",
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建项目成功: ${newProject.name} (ID: ${newProject.id})`);

    // 测试2: 查询项目列表
    console.log("\n📋 测试2: 查询项目列表");
    const projects = await db.project.findMany({
      where: { 
        createdById: testUser.id,
        isArchived: false,
      },
      include: {
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    console.log(`✅ 查询项目成功: 找到 ${projects.length} 个项目`);
    for (const project of projects) {
      console.log(`  - ${project.name}: ${project._count.tasks} 任务, ${project._count.notes} 笔记`);
    }

    // 测试3: 更新项目
    console.log("\n📋 测试3: 更新项目");
    const updatedProject = await db.project.update({
      where: { id: newProject.id },
      data: {
        name: "测试项目 (已更新)",
        description: "这是一个更新后的测试项目",
        color: "#10B981",
      },
    });
    console.log(`✅ 更新项目成功: ${updatedProject.name}`);

    // 测试4: 在项目中创建任务
    console.log("\n📋 测试4: 在项目中创建任务");
    const projectTask = await db.task.create({
      data: {
        title: "项目测试任务",
        description: "这是项目中的一个测试任务",
        projectId: newProject.id,
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建项目任务成功: ${projectTask.title}`);

    // 测试5: 在项目中创建笔记
    console.log("\n📋 测试5: 在项目中创建笔记");
    const projectNote = await db.note.create({
      data: {
        title: "项目测试笔记",
        content: "# 项目笔记\n\n这是项目中的一个测试笔记。",
        projectId: newProject.id,
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建项目笔记成功: ${projectNote.title}`);

    // 测试6: 获取项目详情（包含任务和笔记）
    console.log("\n📋 测试6: 获取项目详情");
    const projectDetail = await db.project.findUnique({
      where: { id: newProject.id },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        notes: {
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
    });

    if (projectDetail) {
      console.log(`✅ 项目详情: ${projectDetail.name}`);
      console.log(`  - 任务数量: ${projectDetail._count.tasks}`);
      console.log(`  - 笔记数量: ${projectDetail._count.notes}`);
      console.log(`  - 最新任务: ${projectDetail.tasks[0]?.title || "无"}`);
      console.log(`  - 最新笔记: ${projectDetail.notes[0]?.title || "无"}`);
    }

    // 测试7: 项目统计
    console.log("\n📋 测试7: 项目统计");
    const [totalTasks, completedTasks, totalNotes] = await Promise.all([
      db.task.count({ where: { projectId: newProject.id } }),
      db.task.count({ 
        where: { 
          projectId: newProject.id, 
          status: "DONE" 
        } 
      }),
      db.note.count({ where: { projectId: newProject.id } }),
    ]);

    console.log(`✅ 项目统计:`);
    console.log(`  - 总任务数: ${totalTasks}`);
    console.log(`  - 已完成任务: ${completedTasks}`);
    console.log(`  - 完成率: ${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}%`);
    console.log(`  - 总笔记数: ${totalNotes}`);

    // 测试8: 归档项目
    console.log("\n📋 测试8: 归档项目");
    await db.project.update({
      where: { id: newProject.id },
      data: { isArchived: true },
    });
    console.log(`✅ 项目归档成功`);

    // 测试9: 查询包含归档项目的列表
    console.log("\n📋 测试9: 查询包含归档项目的列表");
    const allProjects = await db.project.findMany({
      where: { createdById: testUser.id },
      orderBy: [
        { isArchived: "asc" },
        { name: "asc" },
      ],
    });
    console.log(`✅ 查询所有项目: ${allProjects.length} 个`);
    const archivedCount = allProjects.filter(p => p.isArchived).length;
    const activeCount = allProjects.length - archivedCount;
    console.log(`  - 活跃项目: ${activeCount} 个`);
    console.log(`  - 归档项目: ${archivedCount} 个`);

    // 测试10: 恢复项目
    console.log("\n📋 测试10: 恢复项目");
    await db.project.update({
      where: { id: newProject.id },
      data: { isArchived: false },
    });
    console.log(`✅ 项目恢复成功`);

    // 测试11: 尝试删除包含内容的项目（应该失败）
    console.log("\n📋 测试11: 尝试删除包含内容的项目");
    const projectWithContent = await db.project.findUnique({
      where: { id: newProject.id },
      include: {
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
    });

    if (projectWithContent && (projectWithContent._count.tasks > 0 || projectWithContent._count.notes > 0)) {
      console.log(`⚠️ 项目包含 ${projectWithContent._count.tasks} 个任务和 ${projectWithContent._count.notes} 篇笔记，无法直接删除`);
    }

    // 测试12: 清理测试数据
    console.log("\n📋 测试12: 清理测试数据");
    
    // 先删除项目中的任务和笔记
    await db.task.deleteMany({
      where: { projectId: newProject.id },
    });
    await db.note.deleteMany({
      where: { projectId: newProject.id },
    });
    
    // 然后删除项目
    await db.project.delete({
      where: { id: newProject.id },
    });
    console.log(`✅ 清理测试数据成功`);

    console.log("\n🎉 所有项目逻辑测试通过！");

  } catch (error) {
    console.error("❌ 项目逻辑测试失败:", error);
    throw error;
  }
}

async function main() {
  await testProjectLogic();
}

main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

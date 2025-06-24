/**
 * 笔记逻辑测试脚本
 * 直接测试笔记相关的数据库操作
 */

import { db } from "@/server/db";

async function testNoteLogic() {
  console.log("🧪 开始测试笔记逻辑...");

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

    // 获取一个测试项目
    const testProject = await db.project.findFirst({
      where: { createdById: testUser.id },
    });

    // 获取一个测试任务
    const testTask = await db.task.findFirst({
      where: { createdById: testUser.id },
    });

    // 获取一个测试标签
    const testTag = await db.tag.findFirst({
      where: { createdById: testUser.id },
    });

    // 测试1: 创建笔记
    console.log("\n📋 测试1: 创建笔记");
    const newNote = await db.note.create({
      data: {
        title: "测试笔记",
        content: `# 测试笔记

这是一个用于测试的 Markdown 笔记。

## 功能特性
- 支持 Markdown 格式
- 可以关联任务
- 支持标签分类
- 项目归属管理

## 代码示例
\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

## 任务清单
- [x] 创建笔记功能
- [ ] 添加搜索功能
- [ ] 实现标签管理`,
        projectId: testProject?.id,
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建笔记成功: ${newNote.title} (ID: ${newNote.id})`);

    // 测试2: 关联标签
    if (testTag) {
      console.log("\n📋 测试2: 关联标签");
      await db.noteTag.create({
        data: {
          noteId: newNote.id,
          tagId: testTag.id,
        },
      });
      console.log(`✅ 关联标签成功: ${testTag.name}`);
    }

    // 测试3: 关联任务
    if (testTask) {
      console.log("\n📋 测试3: 关联任务");
      await db.note.update({
        where: { id: newNote.id },
        data: {
          linkedTasks: {
            connect: { id: testTask.id },
          },
        },
      });
      console.log(`✅ 关联任务成功: ${testTask.title}`);
    }

    // 测试4: 查询笔记列表
    console.log("\n📋 测试4: 查询笔记列表");
    const notes = await db.note.findMany({
      where: { 
        createdById: testUser.id,
        isArchived: false,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        linkedTasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        _count: {
          select: {
            linkedTasks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    console.log(`✅ 查询笔记成功: 找到 ${notes.length} 篇笔记`);
    for (const note of notes) {
      console.log(`  - ${note.title}: ${note._count.linkedTasks} 个关联任务`);
      if (note.project) {
        console.log(`    项目: ${note.project.name}`);
      }
      if (note.tags.length > 0) {
        console.log(`    标签: ${note.tags.map(t => t.tag.name).join(", ")}`);
      }
    }

    // 测试5: 获取笔记详情
    console.log("\n📋 测试5: 获取笔记详情");
    const noteDetail = await db.note.findUnique({
      where: { id: newNote.id },
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
        linkedTasks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    });

    if (noteDetail) {
      console.log(`✅ 笔记详情: ${noteDetail.title}`);
      console.log(`  - 内容长度: ${noteDetail.content.length} 字符`);
      console.log(`  - 项目: ${noteDetail.project?.name || "无"}`);
      console.log(`  - 标签: ${noteDetail.tags.map(t => t.tag.name).join(", ") || "无"}`);
      console.log(`  - 关联任务: ${noteDetail.linkedTasks.length} 个`);
    }

    // 测试6: 更新笔记
    console.log("\n📋 测试6: 更新笔记");
    const updatedNote = await db.note.update({
      where: { id: newNote.id },
      data: {
        title: "测试笔记 (已更新)",
        content: newNote.content + "\n\n## 更新日志\n- 添加了更新日志部分",
      },
    });
    console.log(`✅ 更新笔记成功: ${updatedNote.title}`);

    // 测试7: 搜索笔记
    console.log("\n📋 测试7: 搜索笔记");
    const searchResults = await db.note.findMany({
      where: {
        createdById: testUser.id,
        isArchived: false,
        OR: [
          { title: { contains: "测试", mode: "insensitive" } },
          { content: { contains: "测试", mode: "insensitive" } },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            linkedTasks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    console.log(`✅ 搜索笔记成功: 找到 ${searchResults.length} 篇相关笔记`);

    // 测试8: 笔记统计
    console.log("\n📋 测试8: 笔记统计");
    const [totalNotes, archivedNotes, notesWithTasks] = await Promise.all([
      db.note.count({ where: { createdById: testUser.id } }),
      db.note.count({ 
        where: { 
          createdById: testUser.id, 
          isArchived: true 
        } 
      }),
      db.note.count({
        where: {
          createdById: testUser.id,
          linkedTasks: {
            some: {},
          },
        },
      }),
    ]);

    console.log(`✅ 笔记统计:`);
    console.log(`  - 总笔记数: ${totalNotes}`);
    console.log(`  - 归档笔记: ${archivedNotes}`);
    console.log(`  - 活跃笔记: ${totalNotes - archivedNotes}`);
    console.log(`  - 有关联任务的笔记: ${notesWithTasks}`);
    console.log(`  - 无关联任务的笔记: ${totalNotes - notesWithTasks}`);

    // 测试9: 归档笔记
    console.log("\n📋 测试9: 归档笔记");
    await db.note.update({
      where: { id: newNote.id },
      data: { isArchived: true },
    });
    console.log(`✅ 笔记归档成功`);

    // 测试10: 恢复笔记
    console.log("\n📋 测试10: 恢复笔记");
    await db.note.update({
      where: { id: newNote.id },
      data: { isArchived: false },
    });
    console.log(`✅ 笔记恢复成功`);

    // 测试11: 取消任务关联
    if (testTask) {
      console.log("\n📋 测试11: 取消任务关联");
      await db.note.update({
        where: { id: newNote.id },
        data: {
          linkedTasks: {
            disconnect: { id: testTask.id },
          },
        },
      });
      console.log(`✅ 取消任务关联成功`);
    }

    // 测试12: 清理测试数据
    console.log("\n📋 测试12: 清理测试数据");
    await db.note.delete({
      where: { id: newNote.id },
    });
    console.log(`✅ 清理测试数据成功`);

    console.log("\n🎉 所有笔记逻辑测试通过！");

  } catch (error) {
    console.error("❌ 笔记逻辑测试失败:", error);
    throw error;
  }
}

async function main() {
  await testNoteLogic();
}

void main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });

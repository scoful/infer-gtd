/**
 * 日志逻辑测试脚本
 * 直接测试日志相关的数据库操作
 */

import { db } from "@/server/db";

async function testJournalLogic() {
  console.log("🧪 开始测试日志逻辑...");

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

    // 测试1: 创建日志
    console.log("\n📋 测试1: 创建日志");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newJournal = await db.journal.create({
      data: {
        date: today,
        content: `# 今日日志 - ${today.toLocaleDateString()}

## 今日完成
- ✅ 完成了日志管理 API 的开发
- ✅ 实现了完整的 CRUD 操作
- ✅ 添加了时间线和统计功能

## 今日学习
- 深入理解了 tRPC 的高级用法
- 学习了复杂的数据库查询优化
- 掌握了日志系统的设计模式

## 遇到的问题
- 日期唯一约束的处理需要特别注意
- 时间线查询的性能优化

## 明日计划
- [ ] 开始前端界面开发
- [ ] 实现任务看板功能
- [ ] 设计用户界面布局

## 心得感悟
今天的开发工作让我对系统架构有了更深的理解。日志系统作为个人知识管理的重要组成部分，需要在功能性和易用性之间找到平衡。

## 技术笔记
\`\`\`typescript
// 日志的唯一约束实现
@@unique([date, createdById])
\`\`\`

这种设计确保了每个用户每天只能有一篇日志，符合日志的本质特征。`,
        template: "daily-work",
        createdById: testUser.id,
      },
    });
    console.log(`✅ 创建日志成功: ${newJournal.date.toLocaleDateString()} (ID: ${newJournal.id})`);

    // 测试2: 按日期查询日志
    console.log("\n📋 测试2: 按日期查询日志");
    const journalByDate = await db.journal.findFirst({
      where: {
        date: today,
        createdById: testUser.id,
      },
    });

    if (journalByDate) {
      console.log(`✅ 按日期查询成功: 找到 ${journalByDate.date.toLocaleDateString()} 的日志`);
      console.log(`  - 内容长度: ${journalByDate.content.length} 字符`);
      console.log(`  - 使用模板: ${journalByDate.template || "无"}`);
    }

    // 测试3: 创建多天的日志
    console.log("\n📋 测试3: 创建多天的日志");
    const journalDates = [];
    for (let i = 1; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      journalDates.push(date);

      await db.journal.create({
        data: {
          date,
          content: `# 日志 - ${date.toLocaleDateString()}

## 今日总结
这是 ${i} 天前的日志记录。

## 主要活动
- 进行了系统开发工作
- 学习了新的技术知识
- 完成了日常任务

## 反思
每天的记录都很重要，有助于回顾和总结。

字数统计测试：${"测试内容 ".repeat(i * 10)}`,
          template: i % 2 === 0 ? "daily-work" : "personal",
          createdById: testUser.id,
        },
      });
    }
    console.log(`✅ 创建多天日志成功: ${journalDates.length} 篇`);

    // 测试4: 查询日志列表
    console.log("\n📋 测试4: 查询日志列表");
    const journals = await db.journal.findMany({
      where: { createdById: testUser.id },
      orderBy: { date: "desc" },
      take: 10,
    });
    console.log(`✅ 查询日志列表成功: 找到 ${journals.length} 篇日志`);
    for (const journal of journals) {
      console.log(`  - ${journal.date.toLocaleDateString()}: ${journal.content.length} 字符`);
    }

    // 测试5: 更新日志（upsert 测试）
    console.log("\n📋 测试5: 更新日志");
    const updatedJournal = await db.journal.upsert({
      where: {
        date_createdById: {
          date: today,
          createdById: testUser.id,
        },
      },
      update: {
        content: newJournal.content + "\n\n## 更新内容\n- 添加了更新测试部分",
      },
      create: {
        date: today,
        content: "这不应该被创建",
        createdById: testUser.id,
      },
    });
    console.log(`✅ 更新日志成功: ${updatedJournal.date.toLocaleDateString()}`);

    // 测试6: 搜索日志
    console.log("\n📋 测试6: 搜索日志");
    const searchResults = await db.journal.findMany({
      where: {
        createdById: testUser.id,
        content: {
          contains: "API",
          mode: "insensitive",
        },
      },
      orderBy: { date: "desc" },
    });
    console.log(`✅ 搜索日志成功: 找到 ${searchResults.length} 篇包含 "API" 的日志`);

    // 测试7: 日志统计
    console.log("\n📋 测试7: 日志统计");
    const [totalJournals, templatesUsed] = await Promise.all([
      db.journal.count({ where: { createdById: testUser.id } }),
      db.journal.groupBy({
        by: ["template"],
        where: {
          createdById: testUser.id,
          template: { not: null },
        },
        _count: { template: true },
      }),
    ]);

    // 计算总字数
    const allJournals = await db.journal.findMany({
      where: { createdById: testUser.id },
      select: { content: true },
    });
    const totalWords = allJournals.reduce((sum, journal) => sum + journal.content.length, 0);

    console.log(`✅ 日志统计:`);
    console.log(`  - 总日志数: ${totalJournals}`);
    console.log(`  - 总字数: ${totalWords}`);
    console.log(`  - 平均字数: ${totalJournals > 0 ? Math.round(totalWords / totalJournals) : 0}`);
    console.log(`  - 模板使用情况:`);
    for (const template of templatesUsed) {
      console.log(`    - ${template.template}: ${template._count.template} 次`);
    }

    // 测试8: 时间线查询
    console.log("\n📋 测试8: 时间线查询");
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);

    const timelineJournals = await db.journal.findMany({
      where: {
        createdById: testUser.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        template: true,
        content: true,
      },
    });

    console.log(`✅ 时间线查询成功: ${currentYear}年${currentMonth}月有 ${timelineJournals.length} 篇日志`);

    // 生成日历数据
    const calendar: Record<string, boolean> = {};
    timelineJournals.forEach(journal => {
      const dateKey = journal.date.toISOString().split('T')[0];
      calendar[dateKey!] = true;
    });
    console.log(`  - 有日志的日期: ${Object.keys(calendar).length} 天`);

    // 测试9: 写作习惯分析
    console.log("\n📋 测试9: 写作习惯分析");
    const recentJournals = await db.journal.findMany({
      where: {
        createdById: testUser.id,
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天
        },
      },
      select: {
        date: true,
        content: true,
        createdAt: true,
      },
    });

    const writingTimes: Record<number, number> = {};
    const weeklyPattern: Record<number, number> = {};

    recentJournals.forEach(journal => {
      const hour = journal.createdAt.getHours();
      const dayOfWeek = journal.date.getDay();
      
      writingTimes[hour] = (writingTimes[hour] || 0) + 1;
      weeklyPattern[dayOfWeek] = (weeklyPattern[dayOfWeek] || 0) + 1;
    });

    console.log(`✅ 写作习惯分析:`);
    console.log(`  - 最近30天日志: ${recentJournals.length} 篇`);
    console.log(`  - 写作时间分布:`, writingTimes);
    console.log(`  - 每周写作模式:`, weeklyPattern);

    // 测试10: 清理测试数据
    console.log("\n📋 测试10: 清理测试数据");
    const deletedCount = await db.journal.deleteMany({
      where: {
        createdById: testUser.id,
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天的测试数据
        },
      },
    });
    console.log(`✅ 清理测试数据成功: 删除了 ${deletedCount.count} 篇日志`);

    console.log("\n🎉 所有日志逻辑测试通过！");

  } catch (error) {
    console.error("❌ 日志逻辑测试失败:", error);
    throw error;
  }
}

async function main() {
  await testJournalLogic();
}

void main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });

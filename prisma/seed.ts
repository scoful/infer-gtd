import { PrismaClient, TaskStatus, TaskType, Priority } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始种子数据生成...");

  // 清理现有数据（开发环境）
  await prisma.taskStatusHistory.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.noteTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.note.deleteMany();
  await prisma.journal.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();

  console.log("🧹 清理完成");

  // 创建测试用户（使用固定ID便于测试）
  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      id: "test-user-id",
      name: "测试用户",
      email: "test@example.com",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
  });

  console.log("👤 创建测试用户:", testUser.name);

  // 创建项目
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        name: "个人成长",
        description: "个人学习和成长相关的任务",
        color: "#3B82F6",
        createdById: testUser.id,
      },
    }),
    prisma.project.create({
      data: {
        name: "工作项目",
        description: "日常工作任务和项目",
        color: "#10B981",
        createdById: testUser.id,
      },
    }),
    prisma.project.create({
      data: {
        name: "生活管理",
        description: "日常生活事务管理",
        color: "#F59E0B",
        createdById: testUser.id,
      },
    }),
  ]);

  console.log("📁 创建项目:", projects.map(p => p.name).join(", "));

  // 创建标签
  const tags = await Promise.all([
    prisma.tag.create({
      data: {
        name: "紧急",
        color: "#EF4444",
        createdById: testUser.id,
      },
    }),
    prisma.tag.create({
      data: {
        name: "学习",
        color: "#8B5CF6",
        createdById: testUser.id,
      },
    }),
    prisma.tag.create({
      data: {
        name: "健康",
        color: "#06B6D4",
        createdById: testUser.id,
      },
    }),
    prisma.tag.create({
      data: {
        name: "编程",
        color: "#84CC16",
        createdById: testUser.id,
      },
    }),
  ]);

  console.log("🏷️ 创建标签:", tags.map(t => t.name).join(", "));

  // 创建复杂的任务场景
  const tasks = [];

  // 1. 想法阶段的任务
  const ideaTask = await prisma.task.create({
    data: {
      title: "学习 React 19 新特性",
      description: "研究 React 19 的新功能，包括 Server Components 和 Concurrent Features",
      status: TaskStatus.IDEA,
      type: TaskType.NORMAL,
      priority: Priority.MEDIUM,
      createdById: testUser.id,
      projectId: projects[0].id,
    },
  });
  tasks.push(ideaTask);

  // 2. 进行中的任务（带时间追踪）
  const activeTask = await prisma.task.create({
    data: {
      title: "完成项目文档",
      description: "编写项目的技术文档和用户手册",
      status: TaskStatus.IN_PROGRESS,
      type: TaskType.DEADLINE,
      priority: Priority.HIGH,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
      dueTime: "18:00",
      isTimerActive: true,
      timerStartedAt: new Date(),
      totalTimeSpent: 3600, // 1小时
      createdById: testUser.id,
      projectId: projects[1].id,
    },
  });
  tasks.push(activeTask);

  // 3. 重复任务
  const recurringTask = await prisma.task.create({
    data: {
      title: "每日晨练",
      description: "每天早上30分钟的运动",
      status: TaskStatus.DONE,
      type: TaskType.NORMAL,
      priority: Priority.MEDIUM,
      isRecurring: true,
      recurringPattern: JSON.stringify({
        type: "daily",
        interval: 1,
        time: "07:00"
      }),
      completedAt: new Date(),
      completedCount: 15,
      totalTimeSpent: 27000, // 7.5小时
      createdById: testUser.id,
      projectId: projects[2].id,
    },
  });
  tasks.push(recurringTask);

  // 4. 等待中的任务
  const waitingTask = await prisma.task.create({
    data: {
      title: "等待设计师反馈",
      description: "等待UI设计师对新界面设计的反馈",
      status: TaskStatus.WAITING,
      type: TaskType.NORMAL,
      priority: Priority.LOW,
      createdById: testUser.id,
      projectId: projects[1].id,
    },
  });
  tasks.push(waitingTask);

  // 5. 已完成的任务
  const completedTask = await prisma.task.create({
    data: {
      title: "设置开发环境",
      description: "配置 Next.js + tRPC + Prisma 开发环境",
      status: TaskStatus.DONE,
      type: TaskType.NORMAL,
      priority: Priority.HIGH,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2天前完成
      completedCount: 1,
      totalTimeSpent: 7200, // 2小时
      createdById: testUser.id,
      projectId: projects[0].id,
    },
  });
  tasks.push(completedTask);

  console.log("📋 创建任务:", tasks.length, "个");

  // 为任务添加标签关联
  await Promise.all([
    prisma.taskTag.create({
      data: { taskId: activeTask.id, tagId: tags[0].id }, // 紧急
    }),
    prisma.taskTag.create({
      data: { taskId: ideaTask.id, tagId: tags[1].id }, // 学习
    }),
    prisma.taskTag.create({
      data: { taskId: ideaTask.id, tagId: tags[3].id }, // 编程
    }),
    prisma.taskTag.create({
      data: { taskId: recurringTask.id, tagId: tags[2].id }, // 健康
    }),
  ]);

  console.log("🔗 创建任务标签关联");

  // 创建时间追踪记录
  await Promise.all([
    prisma.timeEntry.create({
      data: {
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小时前开始
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1小时前结束
        duration: 3600, // 1小时
        description: "编写API文档",
        taskId: activeTask.id,
        createdById: testUser.id,
      },
    }),
    prisma.timeEntry.create({
      data: {
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前开始
        endTime: null, // 正在进行中
        description: "继续编写文档",
        taskId: activeTask.id,
        createdById: testUser.id,
      },
    }),
  ]);

  console.log("⏱️ 创建时间追踪记录");

  // 创建任务状态历史
  await Promise.all([
    prisma.taskStatusHistory.create({
      data: {
        fromStatus: null,
        toStatus: TaskStatus.IDEA,
        taskId: ideaTask.id,
        changedById: testUser.id,
        note: "任务创建",
      },
    }),
    prisma.taskStatusHistory.create({
      data: {
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.IN_PROGRESS,
        taskId: activeTask.id,
        changedById: testUser.id,
        note: "开始工作",
      },
    }),
    prisma.taskStatusHistory.create({
      data: {
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.DONE,
        taskId: completedTask.id,
        changedById: testUser.id,
        note: "环境配置完成",
      },
    }),
  ]);

  console.log("📈 创建状态历史记录");

  // 创建笔记
  const notes = await Promise.all([
    prisma.note.create({
      data: {
        title: "React 19 学习笔记",
        content: `# React 19 新特性学习

## Server Components
- 服务器端渲染组件
- 减少客户端 JavaScript 包大小
- 提升首屏加载性能

## Concurrent Features
- useTransition Hook
- useDeferredValue Hook
- Suspense 改进

## 代码示例
\`\`\`jsx
function ServerComponent() {
  // 这个组件在服务器端渲染
  return <div>Hello from server!</div>;
}
\`\`\`

## 参考资料
- [React 19 官方文档](https://react.dev)
- [Server Components RFC](https://github.com/reactjs/rfcs)`,
        createdById: testUser.id,
        projectId: projects[0].id,
      },
    }),
    prisma.note.create({
      data: {
        title: "项目架构设计",
        content: `# 项目架构设计文档

## 技术栈
- **前端**: Next.js 15 + React 19
- **后端**: tRPC + Prisma
- **数据库**: PostgreSQL
- **样式**: Tailwind CSS v4

## 目录结构
\`\`\`
src/
├── app/          # App Router
├── pages/        # Pages Router
├── server/       # 服务端代码
├── components/   # 组件
└── utils/        # 工具函数
\`\`\`

## 数据模型关系
- User -> Projects -> Tasks/Notes
- Tasks -> Tags (多对多)
- Tasks -> TimeEntries (一对多)`,
        createdById: testUser.id,
        projectId: projects[1].id,
      },
    }),
  ]);

  console.log("📝 创建笔记:", notes.length, "篇");

  // 为笔记添加标签
  await Promise.all([
    prisma.noteTag.create({
      data: { noteId: notes[0].id, tagId: tags[1].id }, // 学习
    }),
    prisma.noteTag.create({
      data: { noteId: notes[0].id, tagId: tags[3].id }, // 编程
    }),
  ]);

  // 创建日志
  const journals = await Promise.all([
    prisma.journal.create({
      data: {
        date: new Date(), // 今天
        content: `# 今日工作总结 - ${new Date().toLocaleDateString()}

## 今日完成
- ✅ 完成数据库模型设计
- ✅ 实现 Prisma Schema
- ✅ 编写种子数据脚本
- ✅ 测试模型关联关系

## 今日学习
- 深入理解了 Prisma 的关联关系设计
- 学习了复杂数据模型的最佳实践
- 掌握了数据库索引优化技巧

## 遇到的问题
- 初始数据库迁移时遇到冲突，通过重置解决
- 复杂关联关系的设计需要仔细考虑级联删除策略

## 明日计划
- [ ] 开始 tRPC API 开发
- [ ] 实现任务管理相关接口
- [ ] 编写 API 测试用例
- [ ] 设计前端组件架构

## 心得感悟
今天的数据库设计工作让我更深刻地理解了系统架构的重要性。一个好的数据模型是整个应用的基础，需要在灵活性和性能之间找到平衡。`,
        template: "daily-work",
        createdById: testUser.id,
      },
    }),
    prisma.journal.create({
      data: {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天
        content: `# 项目启动日志 - ${new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString()}

## 项目初始化
今天开始了新的 LLM 驱动的智能 Todo 应用项目。

## 技术选型
经过调研，最终选择了 T3 Stack：
- Next.js 15 - 全栈框架
- tRPC - 类型安全的 API
- Prisma - 数据库 ORM
- NextAuth.js - 身份认证

## 环境搭建
- ✅ 初始化 T3 项目
- ✅ 配置 GitHub OAuth
- ✅ 连接 PostgreSQL 数据库
- ✅ 设置开发环境

## 下一步计划
明天开始数据库模型设计，这是整个项目的基础。`,
        template: "daily-work",
        createdById: testUser.id,
      },
    }),
  ]);

  console.log("📔 创建日志:", journals.length, "篇");

  console.log("✅ 种子数据生成完成！");
  console.log("📊 数据统计:");
  console.log(`  - 用户: 1 个`);
  console.log(`  - 项目: ${projects.length} 个`);
  console.log(`  - 标签: ${tags.length} 个`);
  console.log(`  - 任务: ${tasks.length} 个`);
  console.log(`  - 笔记: ${notes.length} 篇`);
  console.log(`  - 日志: ${journals.length} 篇`);
}

main()
  .catch((e) => {
    console.error("❌ 种子数据生成失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

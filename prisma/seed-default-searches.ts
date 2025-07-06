import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 系统预定义的快速搜索配置
const defaultSearches = [
  {
    name: "今天的任务",
    description: "查看今天创建的任务",
    searchParams: {
      query: "",
      searchIn: ["tasks"],
      taskStatus: [],
      taskType: [],
      priority: [],
      tagIds: [],
      projectIds: [],
      createdAfter: () => new Date().toISOString().split('T')[0], // 今天
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "createdAt",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  },
  {
    name: "本周笔记",
    description: "查看本周创建的笔记",
    searchParams: {
      query: "",
      searchIn: ["notes"],
      taskStatus: [],
      taskType: [],
      priority: [],
      tagIds: [],
      projectIds: [],
      createdAfter: () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 周一开始
        return new Date(now.setDate(diff)).toISOString().split('T')[0];
      },
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "createdAt",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  },
  {
    name: "高优先级任务",
    description: "查看高优先级和紧急任务",
    searchParams: {
      query: "",
      searchIn: ["tasks"],
      taskStatus: [],
      taskType: [],
      priority: ["HIGH", "URGENT"],
      tagIds: [],
      projectIds: [],
      createdAfter: null,
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "priority",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  },
  {
    name: "进行中的项目",
    description: "查看所有项目",
    searchParams: {
      query: "",
      searchIn: ["projects"],
      taskStatus: [],
      taskType: [],
      priority: [],
      tagIds: [],
      projectIds: [],
      createdAfter: null,
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "updatedAt",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  },
  {
    name: "最近的日记",
    description: "查看最近的日记条目",
    searchParams: {
      query: "",
      searchIn: ["journals"],
      taskStatus: [],
      taskType: [],
      priority: [],
      tagIds: [],
      projectIds: [],
      createdAfter: null,
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "createdAt",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  },
  {
    name: "待办事项",
    description: "查看待办状态的任务",
    searchParams: {
      query: "",
      searchIn: ["tasks"],
      taskStatus: ["TODO"],
      taskType: [],
      priority: [],
      tagIds: [],
      projectIds: [],
      createdAfter: null,
      createdBefore: null,
      dueAfter: null,
      dueBefore: null,
      sortBy: "createdAt",
      sortOrder: "desc",
      isCompleted: null,
      isOverdue: null,
      hasDescription: null,
      limit: 20,
    }
  }
];

async function createDefaultSearchesForUser(userId: string) {
  console.log(`为用户 ${userId} 创建默认快速搜索...`);

  for (const searchData of defaultSearches) {
    try {
      // 检查搜索是否已存在
      const existingSearch = await prisma.savedSearch.findFirst({
        where: {
          name: searchData.name,
          createdById: userId,
        },
      });

      if (!existingSearch) {
        // 处理动态日期函数
        const processedParams: any = { ...searchData.searchParams };
        if (typeof processedParams.createdAfter === 'function') {
          processedParams.createdAfter = processedParams.createdAfter();
        }

        await prisma.savedSearch.create({
          data: {
            name: searchData.name,
            description: searchData.description,
            searchParams: JSON.stringify(processedParams),
            isPublic: false,
            createdById: userId,
          },
        });
        console.log(`✅ 创建快速搜索: ${searchData.name}`);
      } else {
        console.log(`⏭️  快速搜索已存在: ${searchData.name}`);
      }
    } catch (error) {
      console.error(`❌ 创建快速搜索失败 ${searchData.name}:`, error);
    }
  }
}

async function seedDefaultSearches() {
  try {
    console.log("🌱 开始创建默认快速搜索...");

    // 获取所有用户
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      console.log("⚠️  没有找到用户，跳过快速搜索创建");
      return;
    }

    // 为每个用户创建默认快速搜索
    for (const user of users) {
      await createDefaultSearchesForUser(user.id);
    }

    console.log("🎉 默认快速搜索创建完成！");
  } catch (error) {
    console.error("❌ 创建默认快速搜索时出错:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedDefaultSearches()
    .then(() => {
      console.log("✅ 默认快速搜索创建成功");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 默认快速搜索创建失败:", error);
      process.exit(1);
    });
}

export { seedDefaultSearches, createDefaultSearchesForUser, defaultSearches };

import { PrismaClient, TagType } from "@prisma/client";

const prisma = new PrismaClient();

// 系统预定义标签配置
const systemTags = [
  // 上下文标签
  {
    name: "@电脑",
    type: TagType.CONTEXT,
    category: "context",
    color: "#3B82F6", // blue-500
    description: "需要使用电脑完成的任务",
    icon: "💻",
    isSystem: true,
  },
  {
    name: "@电话",
    type: TagType.CONTEXT,
    category: "context",
    color: "#10B981", // green-500
    description: "需要打电话或通话的任务",
    icon: "📞",
    isSystem: true,
  },
  {
    name: "@办公室",
    type: TagType.CONTEXT,
    category: "context",
    color: "#8B5CF6", // purple-500
    description: "需要在办公室完成的任务",
    icon: "🏢",
    isSystem: true,
  },
  {
    name: "@家里",
    type: TagType.CONTEXT,
    category: "context",
    color: "#F59E0B", // orange-500
    description: "需要在家里完成的任务",
    icon: "🏠",
    isSystem: true,
  },
  {
    name: "@外出",
    type: TagType.CONTEXT,
    category: "context",
    color: "#EF4444", // red-500
    description: "需要外出办理的任务",
    icon: "🚗",
    isSystem: true,
  },
  {
    name: "@在线",
    type: TagType.CONTEXT,
    category: "context",
    color: "#06B6D4", // cyan-500
    description: "需要网络连接的在线任务",
    icon: "🌐",
    isSystem: true,
  },
  {
    name: "@会议",
    type: TagType.CONTEXT,
    category: "context",
    color: "#84CC16", // lime-500
    description: "会议相关的任务",
    icon: "👥",
    isSystem: true,
  },

  // 优先级标签
  {
    name: "紧急",
    type: TagType.PRIORITY,
    category: "priority",
    color: "#DC2626", // red-600
    description: "紧急重要的任务",
    icon: "🔥",
    isSystem: true,
  },
  {
    name: "重要",
    type: TagType.PRIORITY,
    category: "priority",
    color: "#D97706", // orange-600
    description: "重要但不紧急的任务",
    icon: "⭐",
    isSystem: true,
  },
  {
    name: "一般",
    type: TagType.PRIORITY,
    category: "priority",
    color: "#059669", // green-600
    description: "一般优先级的任务",
    icon: "📝",
    isSystem: true,
  },

  // 项目类型标签
  {
    name: "工作",
    type: TagType.PROJECT,
    category: "project",
    color: "#1F2937", // gray-800
    description: "工作相关的任务",
    icon: "💼",
    isSystem: true,
  },
  {
    name: "个人",
    type: TagType.PROJECT,
    category: "project",
    color: "#7C3AED", // violet-600
    description: "个人生活相关的任务",
    icon: "👤",
    isSystem: true,
  },
  {
    name: "学习",
    type: TagType.PROJECT,
    category: "project",
    color: "#2563EB", // blue-600
    description: "学习和自我提升相关的任务",
    icon: "📚",
    isSystem: true,
  },
  {
    name: "健康",
    type: TagType.PROJECT,
    category: "project",
    color: "#16A34A", // green-600
    description: "健康和运动相关的任务",
    icon: "💪",
    isSystem: true,
  },
  {
    name: "财务",
    type: TagType.PROJECT,
    category: "project",
    color: "#CA8A04", // yellow-600
    description: "财务和理财相关的任务",
    icon: "💰",
    isSystem: true,
  },

  // 等待类型标签
  {
    name: "等待回复",
    type: TagType.CUSTOM,
    category: "waiting",
    color: "#0EA5E9", // sky-500
    description: "等待他人邮件或消息回复",
    icon: "📧",
    isSystem: true,
  },
  {
    name: "等待审批",
    type: TagType.CUSTOM,
    category: "waiting",
    color: "#F97316", // orange-500
    description: "等待上级或相关人员审批",
    icon: "✅",
    isSystem: true,
  },
  {
    name: "等待会议",
    type: TagType.CUSTOM,
    category: "waiting",
    color: "#8B5CF6", // purple-500
    description: "等待会议安排或会议结果",
    icon: "📅",
    isSystem: true,
  },
  {
    name: "委派他人",
    type: TagType.CUSTOM,
    category: "waiting",
    color: "#6366F1", // indigo-500
    description: "已委派给他人处理的任务",
    icon: "👥",
    isSystem: true,
  },
];

async function createSystemTagsForUser(userId: string) {
  console.log(`为用户 ${userId} 创建系统预定义标签...`);

  for (const tagData of systemTags) {
    try {
      // 检查标签是否已存在
      const existingTag = await prisma.tag.findFirst({
        where: {
          name: tagData.name,
          createdById: userId,
        },
      });

      if (!existingTag) {
        await prisma.tag.create({
          data: {
            ...tagData,
            createdById: userId,
          },
        });
        console.log(`✅ 创建标签: ${tagData.name}`);
      } else {
        console.log(`⏭️  标签已存在: ${tagData.name}`);
      }
    } catch (error) {
      console.error(`❌ 创建标签失败 ${tagData.name}:`, error);
    }
  }
}

async function seedSystemTags() {
  try {
    console.log("🌱 开始创建系统预定义标签...");

    // 获取所有用户
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      console.log("⚠️  没有找到用户，跳过标签创建");
      return;
    }

    // 为每个用户创建系统标签
    for (const user of users) {
      await createSystemTagsForUser(user.id);
    }

    console.log("🎉 系统预定义标签创建完成！");
  } catch (error) {
    console.error("❌ 创建系统标签时出错:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedSystemTags()
    .then(() => {
      console.log("✅ 种子数据创建成功");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 种子数据创建失败:", error);
      process.exit(1);
    });
}

export { seedSystemTags, createSystemTagsForUser, systemTags };

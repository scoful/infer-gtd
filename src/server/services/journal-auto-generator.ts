/**
 * 日记自动生成服务
 * 
 * 功能：
 * 1. 定时任务：每天晚上11:55自动生成日记
 * 2. 任务完成触发：完成任务时自动更新日记
 * 3. 去重机制：避免重复生成相同内容
 */

import { db } from "@/server/db";
import { serverLoggers } from "@/utils/logger-server";
import { TaskStatus } from "@prisma/client";

export interface AutoGenerateResult {
  success: boolean;
  message: string;
  journalId?: string;
  tasksCount?: number;
}

/**
 * 为指定用户和日期自动生成日记
 */
export async function autoGenerateJournalForUser(
  userId: string,
  targetDate: Date = new Date(),
  forceGenerate: boolean = false, // 是否强制生成（忽略用户设置）
): Promise<AutoGenerateResult> {
  try {
    // 检查用户设置（除非强制生成）
    if (!forceGenerate) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (user?.settings) {
        try {
          const settings = JSON.parse(user.settings);
          const autoJournalSettings = settings.autoJournalGeneration;

          // 如果用户禁用了自动生成，直接返回
          if (autoJournalSettings && !autoJournalSettings.enabled) {
            return {
              success: false,
              message: "用户已禁用日记自动生成功能",
            };
          }
        } catch (error) {
          // 解析设置失败，继续执行默认行为
          serverLoggers.app.warn(
            { userId, error: error instanceof Error ? error.message : String(error) },
            "解析用户设置失败，使用默认行为",
          );
        }
      }
    }

    // 标准化日期为当天的开始时间
    const normalizedDate = new Date(targetDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // 获取当天完成的任务
    const startOfDay = new Date(normalizedDate);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const completedTasks = await db.task.findMany({
      where: {
        createdById: userId,
        completedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        type: true,
        feedback: true,
        totalTimeSpent: true,
        project: {
          select: {
            name: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    // 如果没有完成的任务，不生成日记
    if (completedTasks.length === 0) {
      return {
        success: false,
        message: "当天没有完成的任务，无需生成日记",
      };
    }

    // 获取用户设置以决定包含哪些信息
    let includeTimeSpent = true;
    let includeProject = true;
    let includeTags = true;

    if (!forceGenerate) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (user?.settings) {
        try {
          const settings = JSON.parse(user.settings);
          const autoJournalSettings = settings.autoJournalGeneration;

          includeTimeSpent = autoJournalSettings?.includeTimeSpent !== false;
          includeProject = autoJournalSettings?.includeProject !== false;
          includeTags = autoJournalSettings?.includeTags !== false;
        } catch (error) {
          // 解析失败，使用默认设置
        }
      }
    }

    // 生成任务列表内容
    const completedTasksList = completedTasks
      .map((task) => {
        const timeSpent = includeTimeSpent && task.totalTimeSpent > 0
          ? ` (用时: ${formatDuration(task.totalTimeSpent)})`
          : "";
        const project = includeProject && task.project ? ` [${task.project.name}]` : "";
        const priority = task.priority ? ` [${task.priority}]` : "";
        const tags = includeTags && task.tags.length > 0
          ? ` #${task.tags.map(t => t.tag.name).join(" #")}`
          : "";

        return `- ${task.title}${project}${priority}${timeSpent}${tags}`;
      })
      .join("\n");

    // 生成默认模板内容
    const year = normalizedDate.getFullYear();
    const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
    const day = String(normalizedDate.getDate()).padStart(2, "0");

    const templateContent = `# ${year}-${month}-${day} 日记

## 今日完成
${completedTasksList}

## 今日学习
-

## 心得感悟
-

## 遇到的问题
-

## 明日计划
-`;

    // 检查当天是否已有日记
    const existingJournal = await db.journal.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        createdById: userId,
      },
    });

    let journal;
    if (existingJournal) {
      // 更新现有日记，在"今日完成"部分追加任务（去重）
      const existingContent = existingJournal.content;

      // 查找"今日完成"部分
      const completedSectionRegex = /## 今日完成\n([\s\S]*?)(?=\n## |$)/;
      const match = completedSectionRegex.exec(existingContent);

      if (match) {
        const existingTasksSection = match[1];
        
        // 提取现有任务标题（去重用）
        const existingTaskTitles = new Set<string>();
        const taskLineRegex = /^- (.+?)(?:\s*\[.*?\])*(?:\s*\(用时:.*?\))*(?:\s*#.*)?$/gm;
        let taskMatch;
        while ((taskMatch = taskLineRegex.exec(existingTasksSection)) !== null) {
          existingTaskTitles.add(taskMatch[1]?.trim() || "");
        }

        // 过滤出新任务
        const newTasks = completedTasks.filter(
          (task) => !existingTaskTitles.has(task.title),
        );

        if (newTasks.length > 0) {
          // 生成新任务列表（使用相同的用户设置）
          const newTasksList = newTasks
            .map((task) => {
              const timeSpent = includeTimeSpent && task.totalTimeSpent > 0
                ? ` (用时: ${formatDuration(task.totalTimeSpent)})`
                : "";
              const project = includeProject && task.project ? ` [${task.project.name}]` : "";
              const priority = task.priority ? ` [${task.priority}]` : "";
              const tags = includeTags && task.tags.length > 0
                ? ` #${task.tags.map(t => t.tag.name).join(" #")}`
                : "";

              return `- ${task.title}${project}${priority}${timeSpent}${tags}`;
            })
            .join("\n");

          // 更新内容：在现有任务后追加新任务
          const updatedTasksSection = existingTasksSection.trim() + "\n" + newTasksList;
          const updatedContent = existingContent.replace(
            completedSectionRegex,
            `## 今日完成\n${updatedTasksSection}\n`,
          );

          journal = await db.journal.update({
            where: { id: existingJournal.id },
            data: { content: updatedContent },
          });

          return {
            success: true,
            message: `已更新当天日记，添加了 ${newTasks.length} 个新完成的任务`,
            journalId: journal.id,
            tasksCount: newTasks.length,
          };
        } else {
          return {
            success: true,
            message: "当天日记已包含所有完成的任务，无需更新",
            journalId: existingJournal.id,
            tasksCount: 0,
          };
        }
      } else {
        // 如果找不到"今日完成"部分，直接替换整个内容
        journal = await db.journal.update({
          where: { id: existingJournal.id },
          data: { content: templateContent },
        });

        return {
          success: true,
          message: `已更新当天日记，包含 ${completedTasks.length} 个完成的任务`,
          journalId: journal.id,
          tasksCount: completedTasks.length,
        };
      }
    } else {
      // 创建新日记
      journal = await db.journal.create({
        data: {
          date: normalizedDate,
          content: templateContent,
          template: "自动生成",
          createdById: userId,
        },
      });

      return {
        success: true,
        message: `已创建新日记，包含 ${completedTasks.length} 个完成的任务`,
        journalId: journal.id,
        tasksCount: completedTasks.length,
      };
    }
  } catch (error) {
    serverLoggers.app.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "自动生成日记失败",
    );
    
    return {
      success: false,
      message: "自动生成日记失败",
    };
  }
}

/**
 * 为所有用户自动生成日记（定时任务用）
 */
export async function autoGenerateJournalForAllUsers(
  targetDate: Date = new Date(),
  specificUserIds?: string[], // 可选：指定用户ID列表
): Promise<{ success: number; failed: number; total: number }> {
  try {
    let activeUsers;

    if (specificUserIds && specificUserIds.length > 0) {
      // 如果指定了用户ID，直接获取这些用户
      activeUsers = await db.user.findMany({
        where: {
          id: {
            in: specificUserIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          settings: true,
        },
      });
    } else {
      // 获取所有活跃用户（最近30天有活动的用户）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      activeUsers = await db.user.findMany({
        where: {
          OR: [
            {
              tasks: {
                some: {
                  updatedAt: {
                    gte: thirtyDaysAgo,
                  },
                },
              },
            },
            {
              journals: {
                some: {
                  updatedAt: {
                    gte: thirtyDaysAgo,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          settings: true,
        },
      });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const user of activeUsers) {
      try {
        // 检查用户是否启用了每日定时生成
        let shouldGenerate = true; // 默认启用
        if (user.settings) {
          try {
            const settings = JSON.parse(user.settings);
            const autoJournalSettings = settings.autoJournalGeneration;
            shouldGenerate = autoJournalSettings?.enabled !== false &&
                           autoJournalSettings?.dailySchedule !== false;
          } catch (error) {
            // 解析失败，使用默认行为
            serverLoggers.app.warn(
              { userId: user.id, error: error instanceof Error ? error.message : String(error) },
              "解析用户设置失败，使用默认行为",
            );
          }
        }

        if (!shouldGenerate) {
          serverLoggers.app.info(
            { userId: user.id },
            "用户已禁用每日定时生成，跳过",
          );
          continue;
        }

        const result = await autoGenerateJournalForUser(user.id, targetDate, true); // 强制生成，因为已经检查过设置
        if (result.success) {
          successCount++;
          serverLoggers.app.info(
            { userId: user.id, message: result.message },
            "用户日记自动生成成功",
          );
        } else {
          failedCount++;
          serverLoggers.app.warn(
            { userId: user.id, message: result.message },
            "用户日记自动生成跳过",
          );
        }
      } catch (error) {
        failedCount++;
        serverLoggers.app.error(
          {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error)
          },
          "用户日记自动生成失败",
        );
      }
    }

    serverLoggers.app.info(
      { 
        total: activeUsers.length, 
        success: successCount, 
        failed: failedCount,
        date: targetDate.toISOString().split('T')[0],
      },
      "批量日记自动生成完成",
    );

    return {
      success: successCount,
      failed: failedCount,
      total: activeUsers.length,
    };
  } catch (error) {
    serverLoggers.app.error(
      { error: error instanceof Error ? error.message : String(error) },
      "批量日记自动生成失败",
    );
    
    return {
      success: 0,
      failed: 0,
      total: 0,
    };
  }
}

/**
 * 格式化时长显示
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

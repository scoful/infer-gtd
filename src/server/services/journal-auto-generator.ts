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
  forceGenerate = false, // 是否强制生成（忽略用户设置）
  templateName = "默认模板", // 模板名称
  respectIncludeSettings = true, // 是否遵循包含信息设置
): Promise<AutoGenerateResult> {
  try {
    // 添加调试日志
    serverLoggers.app.info(
      {
        userId,
        targetDate: targetDate.toISOString(),
        forceGenerate,
        templateName,
      },
      "开始自动生成日记",
    );

    // 检查用户设置（除非强制生成）
    if (!forceGenerate) {
      // 移除了总开关检查，现在由具体的子功能开关控制
    }

    // 标准化日期为当天的开始时间
    const normalizedDate = new Date(targetDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // 获取当天完成的任务
    const startOfDay = new Date(normalizedDate);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 查询当天完成的任务
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

    // 添加调试日志
    serverLoggers.app.info(
      {
        userId,
        completedTasksCount: completedTasks.length,
        taskTitles: completedTasks.map((t) => t.title),
      },
      "查询到的完成任务",
    );

    // 如果没有完成的任务，不生成日记
    if (completedTasks.length === 0) {
      serverLoggers.app.info({ userId }, "没有完成的任务，跳过日记生成");
      return {
        success: false,
        message: "当天没有完成的任务，无需生成日记",
      };
    }

    // 获取用户设置以决定包含哪些信息
    let includeTimeSpent = true;
    let includeProject = true;
    let includeTags = true;

    if (respectIncludeSettings) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      if (user?.settings) {
        try {
          const settings = JSON.parse(user.settings);
          const autoJournalSettings = settings.autoJournalGeneration;

          // 明确检查设置值，默认为true
          includeTimeSpent = autoJournalSettings?.includeTimeSpent ?? true;
          includeProject = autoJournalSettings?.includeProject ?? true;
          includeTags = autoJournalSettings?.includeTags ?? true;

          // 添加调试日志
          serverLoggers.app.info(
            {
              userId,
              respectIncludeSettings,
              includeTimeSpent,
              includeProject,
              includeTags,
              rawSettings: autoJournalSettings,
            },
            "包含信息设置读取结果",
          );
        } catch {
          // 解析失败，使用默认设置
        }
      }
    }

    // 生成任务列表内容（使用美观的格式）
    const completedTasksList = completedTasks
      .map((task) => {
        let taskLine = `- [x] **${task.title}**`;

        // 添加项目信息
        if (includeProject && task.project?.name) {
          taskLine += ` (${task.project.name})`;
        }

        // 添加优先级（中文显示）
        if (task.priority) {
          const priorityMap = {
            LOW: "低",
            MEDIUM: "中",
            HIGH: "高",
            URGENT: "紧急",
          };
          taskLine += ` [${priorityMap[task.priority] || task.priority}]`;
        }

        // 添加任务类型（中文显示）
        if (task.type) {
          const typeMap = {
            NORMAL: "普通",
            DEADLINE: "限时",
          };
          taskLine += ` [${typeMap[task.type] || task.type}]`;
        }

        // 添加耗时信息
        if (includeTimeSpent && task.totalTimeSpent > 0) {
          const hours = Math.floor(task.totalTimeSpent / 3600);
          const minutes = Math.floor((task.totalTimeSpent % 3600) / 60);
          if (hours > 0) {
            taskLine += ` [耗时: ${hours}h${minutes}m]`;
          } else if (minutes > 0) {
            taskLine += ` [耗时: ${minutes}m]`;
          }
        }

        // 添加标签
        if (includeTags && task.tags && task.tags.length > 0) {
          const tagNames = task.tags.map((t) => t.tag.name).join(", ");
          taskLine += ` #${tagNames}`;
        }

        // 添加描述（如果有，否则使用占位符）
        if (task.description) {
          taskLine += `\n  > ${task.description}`;
        } else {
          taskLine += `\n  > _暂无描述_`;
        }

        // 添加反馈（如果有，否则使用占位符）
        if (task.feedback) {
          taskLine += `\n  💭 ${task.feedback}`;
        } else {
          taskLine += `\n  💭 _暂无反馈_`;
        }

        return taskLine;
      })
      .join("\n\n");

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

        // 提取现有任务标题（去重用）- 只匹配新格式
        const existingTaskTitles = new Set<string>();
        const existingTaskLines = existingTasksSection
          ? existingTasksSection.split("\n").filter((line) => line.trim())
          : [];
        existingTaskLines.forEach((line) => {
          // 只匹配新格式：- [x] **任务标题**
          const taskMatch = /^-\s*\[x\]\s*\*\*(.+?)\*\*/.exec(line);
          if (taskMatch?.[1]) {
            existingTaskTitles.add(taskMatch[1].trim());
          }
        });

        // 过滤出新任务
        const newTasks = completedTasks.filter(
          (task) => !existingTaskTitles.has(task.title),
        );

        if (newTasks.length > 0) {
          // 生成新任务列表（使用美观格式）
          const newTasksList = newTasks
            .map((task) => {
              let taskLine = `- [x] **${task.title}**`;

              // 添加项目信息
              if (includeProject && task.project?.name) {
                taskLine += ` (${task.project.name})`;
              }

              // 添加优先级（中文显示）
              if (task.priority) {
                const priorityMap = {
                  LOW: "低",
                  MEDIUM: "中",
                  HIGH: "高",
                  URGENT: "紧急",
                };
                taskLine += ` [${priorityMap[task.priority] || task.priority}]`;
              }

              // 添加任务类型（中文显示）
              if (task.type) {
                const typeMap = {
                  NORMAL: "普通",
                  DEADLINE: "限时",
                };
                taskLine += ` [${typeMap[task.type] || task.type}]`;
              }

              // 添加耗时信息
              if (includeTimeSpent && task.totalTimeSpent > 0) {
                const hours = Math.floor(task.totalTimeSpent / 3600);
                const minutes = Math.floor((task.totalTimeSpent % 3600) / 60);
                if (hours > 0) {
                  taskLine += ` [耗时: ${hours}h${minutes}m]`;
                } else if (minutes > 0) {
                  taskLine += ` [耗时: ${minutes}m]`;
                }
              }

              // 添加标签
              if (includeTags && task.tags && task.tags.length > 0) {
                const tagNames = task.tags.map((t) => t.tag.name).join(", ");
                taskLine += ` #${tagNames}`;
              }

              // 添加描述（如果有，否则使用占位符）
              if (task.description) {
                taskLine += `\n  > ${task.description}`;
              } else {
                taskLine += `\n  > _暂无描述_`;
              }

              // 添加反馈（如果有，否则使用占位符）
              if (task.feedback) {
                taskLine += `\n  💭 ${task.feedback}`;
              } else {
                taskLine += `\n  💭 _暂无反馈_`;
              }

              return taskLine;
            })
            .join("\n\n");

          // 更新内容：在现有任务后追加新任务（使用双换行分隔）
          const updatedTasksSection =
            (existingTasksSection?.trim() || "") + "\n\n" + newTasksList;
          const updatedContent = existingContent.replace(
            completedSectionRegex,
            `## 今日完成\n${updatedTasksSection}\n`,
          );

          journal = await db.journal.update({
            where: { id: existingJournal.id },
            data: {
              content: updatedContent,
              template: templateName,
            },
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
        // 如果找不到"今日完成"部分，在开头添加
        const updatedContent = `## 今日完成\n${completedTasksList}\n\n${existingContent}`;
        journal = await db.journal.update({
          where: { id: existingJournal.id },
          data: {
            content: updatedContent,
            template: templateName,
          },
        });

        return {
          success: true,
          message: `已更新当天日记，添加了 ${completedTasks.length} 个完成的任务`,
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
          template: templateName,
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
            shouldGenerate = autoJournalSettings?.dailySchedule !== false;
          } catch (error) {
            // 解析失败，使用默认行为
            serverLoggers.app.warn(
              {
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              },
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

        const result = await autoGenerateJournalForUser(
          user.id,
          targetDate,
          true, // 强制生成，因为已经检查过设置
          "定时自动生成", // 模板名称
          true, // 遵循用户的包含信息设置
        );
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
            error: error instanceof Error ? error.message : String(error),
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
        date: targetDate.toISOString().split("T")[0],
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

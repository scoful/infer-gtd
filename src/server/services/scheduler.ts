/**
 * 定时任务调度器
 * 
 * 功能：
 * 1. 每天晚上11:55自动生成日记
 * 2. 可扩展的定时任务管理
 */

import { serverLoggers } from "@/utils/logger-server";
import { autoGenerateJournalForAllUsers } from "./journal-auto-generator";

interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.registerDefaultTasks();
  }

  /**
   * 注册默认定时任务
   */
  private registerDefaultTasks() {
    // 每分钟检查用户设置并生成日记（动态时间）
    this.registerTask({
      id: "auto-generate-journal",
      name: "自动生成日记",
      cronExpression: "* * * * *", // 每分钟检查一次
      handler: this.handleAutoGenerateJournal.bind(this),
      enabled: true,
    });
  }

  /**
   * 注册定时任务
   */
  registerTask(task: ScheduledTask) {
    this.tasks.set(task.id, task);
    serverLoggers.app.info(
      { taskId: task.id, name: task.name, cron: task.cronExpression },
      "定时任务已注册",
    );
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.isRunning) {
      serverLoggers.app.warn("定时任务调度器已在运行中");
      return;
    }

    this.isRunning = true;
    
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        this.scheduleTask(taskId, task);
      }
    }

    serverLoggers.app.info(
      { enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length },
      "定时任务调度器已启动",
    );
  }

  /**
   * 停止调度器
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    for (const [taskId, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    serverLoggers.app.info("定时任务调度器已停止");
  }

  /**
   * 调度单个任务
   */
  private scheduleTask(taskId: string, task: ScheduledTask) {
    const intervalMs = this.cronToInterval(task.cronExpression);
    
    if (intervalMs === null) {
      serverLoggers.app.error(
        { taskId, cron: task.cronExpression },
        "无效的cron表达式，跳过任务调度",
      );
      return;
    }

    // 计算下次执行时间
    const nextRun = this.getNextRunTime(task.cronExpression);
    const delay = nextRun.getTime() - Date.now();

    // 设置初始延迟执行
    const initialTimeout = setTimeout(() => {
      this.executeTask(task);
      
      // 设置周期性执行
      const interval = setInterval(() => {
        this.executeTask(task);
      }, intervalMs);
      
      this.intervals.set(taskId, interval);
    }, delay);

    serverLoggers.app.info(
      { 
        taskId, 
        name: task.name, 
        nextRun: nextRun.toISOString(),
        delayMs: delay,
      },
      "定时任务已调度",
    );
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask) {
    const startTime = Date.now();
    
    try {
      serverLoggers.app.info(
        { taskId: task.id, name: task.name },
        "开始执行定时任务",
      );

      await task.handler();

      const duration = Date.now() - startTime;
      serverLoggers.app.info(
        { taskId: task.id, name: task.name, duration },
        "定时任务执行成功",
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      serverLoggers.app.error(
        { 
          taskId: task.id, 
          name: task.name, 
          duration,
          error: error instanceof Error ? error.message : String(error),
        },
        "定时任务执行失败",
      );
    }
  }

  /**
   * 将简化的cron表达式转换为间隔毫秒数
   * 支持格式: "分 时 日 月 周"
   */
  private cronToInterval(cron: string): number | null {
    const parts = cron.split(" ");
    if (parts.length !== 5) {
      return null;
    }

    const [minute, hour, day, month, weekday] = parts;

    // 支持每分钟执行 (* * * * *)
    if (minute === "*" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
      return 60 * 1000; // 1分钟
    }

    // 支持每小时执行 (分 * * * *)
    if (hour === "*" && day === "*" && month === "*" && weekday === "*") {
      return 60 * 60 * 1000; // 1小时
    }

    // 支持每日执行 (分 时 * * *)
    if (day === "*" && month === "*" && weekday === "*") {
      return 24 * 60 * 60 * 1000; // 24小时
    }

    return null;
  }

  /**
   * 计算下次执行时间
   */
  private getNextRunTime(cron: string): Date {
    const parts = cron.split(" ");
    const [minute, hour] = parts;

    const now = new Date();
    const next = new Date();

    // 处理每分钟执行的情况 (* * * * *)
    if (minute === "*") {
      // 下一分钟执行
      next.setTime(now.getTime() + 60 * 1000);
      next.setSeconds(0, 0);
      return next;
    }

    // 处理每小时执行的情况 (0 * * * *)
    if (hour === "*") {
      const targetMinute = parseInt(minute || "0");
      if (isNaN(targetMinute)) {
        // 如果分钟解析失败，默认下一分钟执行
        next.setTime(now.getTime() + 60 * 1000);
        next.setSeconds(0, 0);
        return next;
      }

      next.setMinutes(targetMinute, 0, 0);

      // 如果当前小时的目标分钟已过，设置为下一小时
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }

      return next;
    }

    // 处理每日执行的情况 (分 时 * * *)
    const targetHour = parseInt(hour || "0");
    const targetMinute = parseInt(minute || "0");

    if (isNaN(targetHour) || isNaN(targetMinute)) {
      // 如果解析失败，默认下一分钟执行
      next.setTime(now.getTime() + 60 * 1000);
      next.setSeconds(0, 0);
      return next;
    }

    next.setHours(targetHour, targetMinute, 0, 0);

    // 如果今天的时间已过，设置为明天
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * 手动执行任务（用于测试）
   */
  async executeTaskManually(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      serverLoggers.app.error({ taskId }, "任务不存在");
      return false;
    }

    try {
      // 特殊处理日记生成任务，手动执行时强制生成
      if (taskId === "auto-generate-journal") {
        await this.handleAutoGenerateJournal(true); // 传递 forceExecute = true
      } else {
        await this.executeTask(task);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus() {
    return {
      isRunning: this.isRunning,
      tasks: Array.from(this.tasks.values()).map(task => ({
        id: task.id,
        name: task.name,
        cronExpression: task.cronExpression,
        enabled: task.enabled,
        nextRun: task.enabled ? this.getNextRunTime(task.cronExpression) : null,
      })),
    };
  }

  // ========== 具体任务处理器 ==========

  /**
   * 自动生成日记任务处理器
   * 检查每个用户的设置，在正确的时间生成日记
   */
  private async handleAutoGenerateJournal(forceExecute: boolean = false) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 每10分钟打印一次状态日志，避免日志过多
    if (currentMinute % 10 === 0 || forceExecute) {
      serverLoggers.app.info(
        {
          time: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
          forceExecute
        },
        "定时日记生成任务开始检查",
      );
    }

    try {
      // 获取所有启用了定时生成的用户
      const { db } = await import("@/server/db");
      const users = await db.user.findMany({
        select: { id: true, email: true, settings: true },
      });

      let processedUsers = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const user of users) {
        try {
          // 解析用户设置
          let shouldGenerate = false;
          let scheduleTime = "23:55"; // 默认时间

          if (user.settings) {
            try {
              const settings = JSON.parse(user.settings);
              const autoJournalSettings = settings.autoJournalGeneration;

              if (autoJournalSettings?.dailySchedule !== false) {
                scheduleTime = autoJournalSettings?.scheduleTime || "23:55";

                if (forceExecute) {
                  // 手动执行时，忽略时间检查
                  shouldGenerate = true;
                } else {
                  // 定时执行时，检查是否到了该用户的生成时间
                  const timeParts = scheduleTime.split(":").map(Number);
                  const scheduleHour = timeParts[0];
                  const scheduleMinute = timeParts[1];

                  // 允许1分钟的误差范围
                  if (scheduleHour !== undefined && scheduleMinute !== undefined &&
                      currentHour === scheduleHour && Math.abs(currentMinute - scheduleMinute) <= 1) {
                    shouldGenerate = true;
                  }
                }
              }
            } catch (error) {
              // 解析失败，跳过该用户
              continue;
            }
          }

          if (shouldGenerate) {
            processedUsers++;
            const result = await autoGenerateJournalForAllUsers(now, [user.id]);

            if (result.success > 0) {
              successCount++;
              serverLoggers.app.info(
                { userId: user.id, email: user.email, scheduleTime },
                "用户定时日记生成成功",
              );
            } else {
              failedCount++;
            }
          }
        } catch (error) {
          failedCount++;
          serverLoggers.app.error(
            {
              userId: user.id,
              email: user.email,
              error: error instanceof Error ? error.message : String(error),
            },
            "用户定时日记生成失败",
          );
        }
      }

      if (processedUsers > 0) {
        serverLoggers.app.info(
          {
            date: now.toISOString().split('T')[0],
            time: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
            processed: processedUsers,
            success: successCount,
            failed: failedCount,
          },
          "定时日记生成任务完成",
        );
      } else if (currentMinute % 10 === 0) {
        // 每10分钟打印一次状态，显示没有用户需要处理
        serverLoggers.app.info(
          {
            time: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
            totalUsers: users.length,
          },
          "定时日记生成任务检查完成，无用户需要处理",
        );
      }
    } catch (error) {
      serverLoggers.app.error(
        { error: error instanceof Error ? error.message : String(error) },
        "定时日记生成任务执行失败",
      );
    }
  }
}

// 创建全局调度器实例
export const taskScheduler = new TaskScheduler();

// 在应用启动时自动启动调度器
if (typeof window === "undefined") {
  // 只在服务器端启动
  process.nextTick(() => {
    taskScheduler.start();
  });

  // 优雅关闭
  process.on("SIGTERM", () => {
    taskScheduler.stop();
  });

  process.on("SIGINT", () => {
    taskScheduler.stop();
  });
}

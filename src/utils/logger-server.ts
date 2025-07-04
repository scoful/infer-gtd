/**
 * 服务器端日志模块 - Node.js 专用
 *
 * 此模块包含文件系统操作和高级日志功能
 * 仅在 Node.js 环境（API Routes、服务器组件）中使用
 * 不能在 Edge Runtime 环境中使用
 */

import pino from "pino";
import path from "path";
import fs from "fs";
import { env } from "@/env";
import { coreLogger, createCoreModuleLogger } from "./logger-core";

// 日志级别配置
const LOG_LEVEL =
  env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug");

// 检查运行环境
const isServer = typeof window === "undefined";

// 日志文件配置（仅在服务器端使用）
const getLogConfig = () => {
  if (!isServer) return null;

  try {
    const LOG_DIR = env.LOG_DIR || "/app/logs";
    const LOG_FILE = path.join(LOG_DIR, "app.log");

    // 确保日志目录存在并设置权限
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o755 });
    }

    // 检查日志文件权限
    try {
      fs.accessSync(LOG_DIR, fs.constants.W_OK);
    } catch (error) {
      console.warn(`Log directory ${LOG_DIR} is not writable:`, error);
      return null;
    }

    return { LOG_DIR, LOG_FILE };
  } catch (error) {
    console.warn("Failed to setup log configuration:", error);
    return null;
  }
};

// 创建文件输出流（仅在服务器端）
const createFileStream = () => {
  if (!isServer) return null;

  const logConfig = getLogConfig();
  if (!logConfig) return null;

  try {
    // 检查日志文件是否可写
    if (fs.existsSync(logConfig.LOG_FILE)) {
      try {
        fs.accessSync(logConfig.LOG_FILE, fs.constants.W_OK);
      } catch (error) {
        console.warn(`Log file ${logConfig.LOG_FILE} is not writable:`, error);
        return null;
      }
    }

    return pino.destination({
      dest: logConfig.LOG_FILE,
      sync: false,
      mkdir: true,
    });
  } catch (error) {
    console.warn(`Failed to create log file stream:`, error);
    return null;
  }
};

// 创建多输出流
const createStreams = () => {
  const streams: pino.StreamEntry[] = [];

  // 控制台输出流
  if (isServer) {
    streams.push({
      level: LOG_LEVEL as pino.Level,
      stream: process.stdout,
    });
  }

  // 文件输出流（仅在服务器端）
  if (isServer) {
    const fileStream = createFileStream();
    if (fileStream) {
      streams.push({
        level: LOG_LEVEL as pino.Level,
        stream: fileStream,
      });
    }
  }

  return streams;
};

// 创建基础 logger 配置
const baseConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
};

// 创建服务器端 logger（支持文件输出）
export const serverLogger = (() => {
  if (!isServer) {
    // 非服务器环境：使用核心 logger
    return coreLogger;
  }

  // 服务器端环境：尝试创建多流输出
  try {
    const streams = createStreams();
    if (streams.length > 1 && pino.multistream) {
      // 有多个流且支持 multistream
      return pino(baseConfig, pino.multistream(streams));
    } else if (streams.length === 1) {
      // 只有一个流，直接使用
      return pino(baseConfig, streams[0]!.stream);
    } else {
      // 没有可用流，使用基础配置
      return pino(baseConfig);
    }
  } catch (error) {
    console.warn(
      "Failed to create multi-stream logger, falling back to core logger:",
      error,
    );
    return coreLogger;
  }
})();

// 创建不同模块的子 logger
export const createServerModuleLogger = (module: string) => {
  return serverLogger.child({ module });
};

// 预定义的服务器模块 logger
export const serverLoggers = {
  app: createServerModuleLogger("APP"),
  api: createServerModuleLogger("API"),
  trpc: createServerModuleLogger("TRPC"),
  db: createServerModuleLogger("DATABASE"),
  docker: createServerModuleLogger("DOCKER"),
  health: createServerModuleLogger("HEALTH"),
  task: createServerModuleLogger("TASK"),
  note: createServerModuleLogger("NOTE"),
  journal: createServerModuleLogger("JOURNAL"),
  search: createServerModuleLogger("SEARCH"),
  project: createServerModuleLogger("PROJECT"),
} as const;

// 性能监控日志
export const logPerformance = (
  logger: pino.Logger,
  operation: string,
  duration: number,
  context?: Record<string, unknown>,
) => {
  logger.info(
    {
      operation,
      duration,
      ...context,
      type: "performance",
    },
    `${operation} 执行完成，耗时 ${duration}ms`,
  );
};

// 数据库操作日志
export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration?: number,
  context?: Record<string, unknown>,
) => {
  serverLoggers.db.info(
    {
      operation,
      table,
      duration,
      ...context,
      type: "database",
    },
    `数据库操作: ${operation} on ${table}${duration ? ` (${duration}ms)` : ""}`,
  );
};

// tRPC 操作日志
export const logTrpcOperation = (
  procedure: string,
  type: "query" | "mutation",
  duration: number,
  success: boolean,
  userId?: string,
  error?: string,
) => {
  const level = success ? "info" : "error";
  serverLoggers.trpc[level](
    {
      procedure,
      operationType: type,
      duration,
      success,
      userId,
      error,
      type: "trpc",
    },
    `tRPC ${type}: ${procedure} ${success ? "成功" : "失败"} (${duration}ms)`,
  );
};

// Docker 容器日志
export const logDockerEvent = (
  event: string,
  status: string,
  details?: Record<string, unknown>,
) => {
  serverLoggers.docker.info(
    {
      event,
      status,
      ...details,
      type: "docker",
    },
    `Docker: ${event} - ${status}`,
  );
};

// 健康检查日志
export const logHealthCheck = (
  component: string,
  status: "healthy" | "unhealthy" | "starting",
  details?: Record<string, unknown>,
) => {
  const level = status === "unhealthy" ? "error" : "info";
  serverLoggers.health[level](
    {
      component,
      status,
      ...details,
      type: "health",
    },
    `健康检查: ${component} - ${status}`,
  );
};

// 错误日志辅助函数（服务器端增强版）
export const logServerError = (
  logger: pino.Logger,
  error: unknown,
  context?: Record<string, unknown>,
) => {
  const errorInfo = {
    ...context,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : "UnknownError",
    },
  };

  logger.error(errorInfo, "服务器操作失败");
};

// 导出主要的 logger（向后兼容）
export const logger = serverLogger;

export default serverLogger;

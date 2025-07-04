/**
 * 核心日志模块 - Edge Runtime 兼容
 *
 * 此模块专为 Edge Runtime 环境设计，不包含任何 Node.js 特定功能
 * 可以安全地在 middleware、Edge API Routes 等环境中使用
 */

import pino from "pino";
import { env } from "@/env";

// 日志级别配置
const LOG_LEVEL =
  env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug");

// 检查运行环境
const isDevelopment = env.NODE_ENV === "development";
const isServer = typeof window === "undefined";

// 创建自定义的美化输出函数（Edge Runtime 兼容）
const prettyPrint = (obj: any) => {
  const timestamp = obj.time || new Date().toISOString();
  const level =
    obj.level >= 50
      ? "ERROR"
      : obj.level >= 40
        ? "WARN"
        : obj.level >= 30
          ? "INFO"
          : "DEBUG";
  const moduleInfo = obj.module ? `[${obj.module}]` : "";
  const msg = obj.msg ?? "";

  if (isDevelopment && isServer) {
    // 开发环境美化输出
    const colors = {
      ERROR: "\x1b[31m", // 红色
      WARN: "\x1b[33m", // 黄色
      INFO: "\x1b[36m", // 青色
      DEBUG: "\x1b[37m", // 白色
      RESET: "\x1b[0m", // 重置
    };

    console.log(
      `${colors[level as keyof typeof colors]}[${timestamp}] ${level} ${moduleInfo}${colors.RESET} ${msg}`,
    );

    // 输出额外的结构化数据
    const extraData = { ...obj };
    delete extraData.level;
    delete extraData.time;
    delete extraData.msg;
    delete extraData.module;

    if (Object.keys(extraData).length > 0) {
      console.log(
        `${colors[level as keyof typeof colors]}    ${JSON.stringify(extraData, null, 2)}${colors.RESET}`,
      );
    }
  } else {
    // 生产环境JSON输出
    console.log(
      JSON.stringify({
        timestamp,
        level,
        module: obj.module,
        message: msg,
        ...obj,
      }),
    );
  }
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

// 创建 Edge Runtime 兼容的 logger
export const coreLogger =
  isDevelopment && isServer
    ? pino(baseConfig, {
        write: (obj: string) => {
          prettyPrint(JSON.parse(obj));
        },
      })
    : pino(baseConfig);

// 创建不同模块的子 logger
export const createCoreModuleLogger = (module: string) => {
  return coreLogger.child({ module });
};

// 预定义的核心模块 logger（Edge Runtime 安全）
export const coreLoggers = {
  middleware: createCoreModuleLogger("MIDDLEWARE"),
  edge: createCoreModuleLogger("EDGE"),
  auth: createCoreModuleLogger("AUTH"),
  request: createCoreModuleLogger("REQUEST"),
} as const;

// 生成请求ID（Edge Runtime 兼容）
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 请求日志中间件辅助函数（Edge Runtime 兼容）
export const createRequestLogger = (requestId?: string) => {
  return coreLogger.child({
    requestId: requestId || generateRequestId(),
    type: "request",
  });
};

// 错误日志辅助函数（Edge Runtime 兼容）
export const logError = (
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

  logger.error(errorInfo, "操作失败");
};

// API 调用日志（Edge Runtime 兼容）
export const logApiCall = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId?: string,
  userId?: string,
) => {
  coreLoggers.request.info(
    {
      method,
      path,
      statusCode,
      duration,
      requestId,
      userId,
      type: "api",
    },
    `${method} ${path} - ${statusCode} (${duration}ms)`,
  );
};

// 用户操作日志（Edge Runtime 兼容）
export const logUserAction = (
  action: string,
  userId: string,
  details?: Record<string, unknown>,
) => {
  coreLogger.info(
    {
      action,
      userId,
      ...details,
      type: "user_action",
    },
    `用户操作: ${action}`,
  );
};

// 系统事件日志（Edge Runtime 兼容）
export const logSystemEvent = (
  event: string,
  status: "success" | "error" | "info",
  details?: Record<string, unknown>,
) => {
  const level = status === "error" ? "error" : "info";
  coreLoggers.middleware[level](
    {
      event,
      status,
      ...details,
      type: "system",
    },
    `系统事件: ${event}`,
  );
};

export default coreLogger;

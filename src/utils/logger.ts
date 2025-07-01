import pino from "pino";
import { env } from "@/env";

// 日志级别配置
const LOG_LEVEL =
  env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug");

// 检查运行环境
const isDevelopment = env.NODE_ENV === "development";
const isServer = typeof window === "undefined";

// 创建自定义的美化输出函数（避免 worker 线程问题）
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

// 创建主 logger
export const logger =
  isDevelopment && isServer
    ? pino(baseConfig, {
        write: (obj: string) => {
          prettyPrint(JSON.parse(obj));
        },
      })
    : pino(baseConfig);

// 创建不同模块的子 logger
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// 预定义的模块 logger
export const loggers = {
  app: createModuleLogger("APP"),
  api: createModuleLogger("API"),
  trpc: createModuleLogger("TRPC"),
  db: createModuleLogger("DATABASE"),
  auth: createModuleLogger("AUTH"),
  docker: createModuleLogger("DOCKER"),
  health: createModuleLogger("HEALTH"),
  task: createModuleLogger("TASK"),
  note: createModuleLogger("NOTE"),
  journal: createModuleLogger("JOURNAL"),
  search: createModuleLogger("SEARCH"),
} as const;

// 请求日志中间件辅助函数
export const createRequestLogger = (requestId?: string) => {
  return logger.child({
    requestId: requestId || generateRequestId(),
    type: "request",
  });
};

// 生成请求ID
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 错误日志辅助函数
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
  loggers.db.info(
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

// API 调用日志
export const logApiCall = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId?: string,
  userId?: string,
) => {
  loggers.api.info(
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
  loggers.trpc[level](
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

// 用户操作日志
export const logUserAction = (
  action: string,
  userId: string,
  details?: Record<string, unknown>,
) => {
  logger.info(
    {
      action,
      userId,
      ...details,
      type: "user_action",
    },
    `用户操作: ${action}`,
  );
};

// 系统启动日志
export const logSystemEvent = (
  event: string,
  status: "success" | "error" | "info",
  details?: Record<string, unknown>,
) => {
  const level = status === "error" ? "error" : "info";
  loggers.app[level](
    {
      event,
      status,
      ...details,
      type: "system",
    },
    `系统事件: ${event}`,
  );
};

// Docker 容器日志
export const logDockerEvent = (
  event: string,
  status: string,
  details?: Record<string, unknown>,
) => {
  loggers.docker.info(
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
  loggers.health[level](
    {
      component,
      status,
      ...details,
      type: "health",
    },
    `健康检查: ${component} - ${status}`,
  );
};

export default logger;

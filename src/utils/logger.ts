/**
 * 统一日志入口模块
 *
 * 此模块提供向后兼容的日志接口，自动选择合适的日志实现
 * - Edge Runtime 环境：使用 logger-core
 * - Node.js 环境：使用 logger-server（支持文件输出）
 */

// 检查运行环境
const isServer = typeof window === "undefined";

// 通用导出（向后兼容）
export * from "./logger-core";

// 动态选择日志实现
let loggerModule: any;

if (isServer) {
  // 服务器端：尝试使用服务器日志模块
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loggerModule = require("./logger-server");
  } catch (error) {
    console.warn("Failed to load server logger, using core logger:", error);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loggerModule = require("./logger-core");
  }
} else {
  // 客户端：使用核心日志模块
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loggerModule = require("./logger-core");
}

// 导出主要接口
export const logger = loggerModule.serverLogger || loggerModule.coreLogger;
export const loggers = loggerModule.serverLoggers || loggerModule.coreLoggers;

// 导出服务器端特有功能（如果可用）
export const logPerformance = loggerModule.logPerformance;
export const logDatabaseOperation = loggerModule.logDatabaseOperation;
export const logTrpcOperation = loggerModule.logTrpcOperation;
export const logDockerEvent = loggerModule.logDockerEvent;
export const logHealthCheck = loggerModule.logHealthCheck;
export const logServerError = loggerModule.logServerError;

// 默认导出
export default logger;

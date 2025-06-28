import { PrismaClient } from "@prisma/client";

import { env } from "@/env";
import { loggers, logDatabaseOperation, logError } from "@/utils/logger";

const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "warn",
      },
      {
        emit: "event",
        level: "info",
      },
    ],
  });

  // 监听数据库查询事件
  prisma.$on("query", (e) => {
    if (env.NODE_ENV === "development") {
      logDatabaseOperation("query", "unknown", e.duration, {
        query: e.query,
        params: e.params,
        target: e.target,
      });
    }
  });

  // 监听数据库错误事件
  prisma.$on("error", (e) => {
    logError(loggers.db, new Error(e.message), {
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // 监听数据库警告事件
  prisma.$on("warn", (e) => {
    loggers.db.warn(
      {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      },
      "数据库警告",
    );
  });

  // 监听数据库信息事件
  prisma.$on("info", (e) => {
    loggers.db.info(
      {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      },
      "数据库信息",
    );
  });

  return prisma;
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

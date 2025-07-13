import { PrismaClient } from "@prisma/client";

import { env } from "@/env";
import {
  serverLoggers,
  logDatabaseOperation,
  logServerError,
} from "@/utils/logger-server";

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
      // 尝试从SQL查询中解析表名
      const tableMatch = e.query.match(/FROM\s+"?(\w+)"?\.?"?(\w+)"?/i);
      const tableName = tableMatch?.[2] ?? "unknown";

      logDatabaseOperation("query", tableName, e.duration, {
        query: e.query,
        params: e.params,
        target: e.target,
      });
    }
  });

  // 监听数据库错误事件
  prisma.$on("error", (e) => {
    logServerError(serverLoggers.db, new Error(e.message), {
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // 监听数据库警告事件
  prisma.$on("warn", (e) => {
    serverLoggers.db.warn(
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
    serverLoggers.db.info(
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

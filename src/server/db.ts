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
      let tableName = "unknown";

      // 处理不同类型的SQL查询
      if (e.query.trim() === "SELECT 1") {
        tableName = "health_check";
      } else if (e.query.includes("FROM")) {
        // 匹配 FROM "schema"."table" 或 FROM table 格式
        const tableMatch =
          e.query.match(/FROM\s+"?(?:\w+)"?\."?(\w+)"?/i) ||
          e.query.match(/FROM\s+"?(\w+)"?/i);
        tableName = tableMatch?.[1] ?? "unknown";
      } else if (e.query.includes("INSERT INTO")) {
        // 匹配 INSERT INTO "schema"."table" 格式
        const insertMatch =
          e.query.match(/INSERT INTO\s+"?(?:\w+)"?\."?(\w+)"?/i) ||
          e.query.match(/INSERT INTO\s+"?(\w+)"?/i);
        tableName = insertMatch?.[1] ?? "unknown";
      } else if (e.query.includes("UPDATE")) {
        // 匹配 UPDATE "schema"."table" 格式
        const updateMatch =
          e.query.match(/UPDATE\s+"?(?:\w+)"?\."?(\w+)"?/i) ||
          e.query.match(/UPDATE\s+"?(\w+)"?/i);
        tableName = updateMatch?.[1] ?? "unknown";
      } else if (e.query.includes("DELETE FROM")) {
        // 匹配 DELETE FROM "schema"."table" 格式
        const deleteMatch =
          e.query.match(/DELETE FROM\s+"?(?:\w+)"?\."?(\w+)"?/i) ||
          e.query.match(/DELETE FROM\s+"?(\w+)"?/i);
        tableName = deleteMatch?.[1] ?? "unknown";
      }

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

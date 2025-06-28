import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "@/server/db";
import fs from "fs";
import { logHealthCheck, loggers } from "@/utils/logger";

/**
 * 完整健康检查 API 端点
 * 包含数据库连接检查，用于完整的应用健康监控
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 检查启动状态
    const statusFilePath = "/tmp/app-status/startup.status";
    let startupStatus = "UNKNOWN";

    try {
      if (fs.existsSync(statusFilePath)) {
        startupStatus = fs.readFileSync(statusFilePath, "utf8").trim();
      }
    } catch (error) {
      loggers.health.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "无法读取启动状态文件",
      );
    }

    // 如果应用还在启动中，返回启动状态
    if (startupStatus !== "READY") {
      const isStarting = [
        "STARTING",
        "DB_CONNECTING",
        "DB_CONNECTED",
        "MIGRATING",
        "RESETTING_DB",
        "MIGRATED",
        "GENERATING_CLIENT",
        "DB_READY",
        "APP_STARTING",
      ].includes(startupStatus);

      logHealthCheck("application", isStarting ? "starting" : "unhealthy", {
        startupStatus,
      });

      return res.status(isStarting ? 202 : 503).json({
        status: isStarting ? "starting" : "unhealthy",
        timestamp: new Date().toISOString(),
        startupStatus,
        database: "pending",
      });
    }

    // 应用已就绪，检查数据库连接
    await db.$queryRaw`SELECT 1`;

    logHealthCheck("application", "healthy", {
      database: "connected",
      startupStatus,
    });

    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      startupStatus,
    });
  } catch (error) {
    logHealthCheck("application", "unhealthy", {
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

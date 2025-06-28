import { type NextApiRequest, type NextApiResponse } from "next";
import fs from "fs";
import { logHealthCheck, loggers } from "@/utils/logger";
import path from "path";

/**
 * 基础健康检查 API 端点
 * 不依赖数据库，用于容器启动期间的健康检查
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 检查启动状态文件
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

    // 检查应用基本状态
    const isReady = startupStatus === "READY";
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

    const status = isReady ? "ready" : isStarting ? "starting" : "unhealthy";
    const httpStatus = isReady ? 200 : isStarting ? 202 : 503;

    logHealthCheck("basic", status as "healthy" | "unhealthy" | "starting", {
      startupStatus,
      ready: isReady,
      starting: isStarting,
    });

    return res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      startupStatus,
      ready: isReady,
      starting: isStarting,
    });
  } catch (error) {
    logHealthCheck("basic", "unhealthy", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

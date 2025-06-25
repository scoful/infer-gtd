import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "@/server/db";

/**
 * 健康检查 API 端点
 * 用于 Docker 容器健康监控
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 检查数据库连接
    await db.$queryRaw`SELECT 1`;
    
    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    
    return res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

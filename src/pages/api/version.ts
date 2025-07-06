import { type NextApiRequest, type NextApiResponse } from "next";
import fs from "fs";
import path from "path";

interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  environment: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<VersionInfo | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 尝试从项目根目录读取版本文件
    const versionPath = path.join(process.cwd(), "version.json");

    let versionData: VersionInfo;

    if (fs.existsSync(versionPath)) {
      const versionContent = fs.readFileSync(versionPath, "utf8");
      versionData = JSON.parse(versionContent);
    } else {
      // 如果版本文件不存在，返回默认版本信息
      versionData = {
        version: "1.0.0",
        major: 1,
        minor: 0,
        patch: 0,
        buildTime: new Date().toISOString(),
        gitCommit: "",
        gitBranch: "",
        environment: process.env.NODE_ENV || "development",
      };
    }

    // 设置缓存头
    res.setHeader("Cache-Control", "public, max-age=300"); // 5分钟缓存
    res.status(200).json(versionData);
  } catch (error) {
    console.error("获取版本信息失败:", error);
    res.status(500).json({ error: "Failed to get version info" });
  }
}

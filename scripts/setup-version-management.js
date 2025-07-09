#!/usr/bin/env node

/**
 * 版本管理系统设置脚本
 * 一键设置完整的自动化版本管理系统
 */

import { execSync } from "child_process";

console.log("🚀 设置自动化版本管理系统...\n");

try {
  // 1. 安装 Git Hooks
  console.log("📋 步骤 1: 安装 Git Hooks");
  execSync("node scripts/install-hooks.js install", { stdio: "inherit" });
  console.log("");

  // 2. 初始化版本信息
  console.log("📋 步骤 2: 初始化版本信息");
  execSync("node scripts/version-manager.js set-env development", {
    stdio: "inherit",
  });
  console.log("");

  // 3. 显示当前版本
  console.log("📋 步骤 3: 当前版本信息");
  execSync("node scripts/version-manager.js show", { stdio: "inherit" });
  console.log("");

  console.log("🎉 自动化版本管理系统设置完成！\n");

  console.log("📖 使用说明:");
  console.log("");
  console.log("🔄 自动版本管理:");
  console.log("   • git commit: 自动增加 patch 版本 (1.0.0 → 1.0.1)");
  console.log("   • git push: 自动增加 minor 版本 (1.0.1 → 1.1.0) 并包含在推送中");
  console.log("");
  console.log("🛠️ 手动版本管理:");
  console.log("   • pnpm version:patch   # 手动增加 patch 版本");
  console.log("   • pnpm version:minor   # 手动增加 minor 版本");
  console.log("   • pnpm version:major   # 手动增加 major 版本");
  console.log("   • pnpm version:show    # 显示当前版本信息");
  console.log("   • pnpm version:sync    # 同步版本到 package.json");
  console.log("");
  console.log("🔧 环境管理:");
  console.log("   • pnpm version:set-env development   # 设置开发环境");
  console.log("   • pnpm version:set-env production    # 设置生产环境");
  console.log("");
  console.log("🎯 Git Hooks 管理:");
  console.log("   • pnpm hooks:install     # 安装自动版本管理钩子");
  console.log("   • pnpm hooks:uninstall   # 卸载自动版本管理钩子");
  console.log("");
  console.log("💡 版本显示位置:");
  console.log("   • 桌面端: 侧边栏底部（可点击查看详情）");
  console.log("   • 移动端: 页面底部");
  console.log("   • 开发环境: 显示详细信息（构建时间、Git 信息等）");
  console.log("   • 生产环境: 显示简洁版本号");
} catch (error) {
  console.error(
    "❌ 设置过程中出现错误:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}

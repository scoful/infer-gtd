#!/usr/bin/env node

/**
 * Git Hooks 安装脚本
 * 自动安装 pre-commit 和 pre-push 钩子
 */

import fs from "fs";
import path from "path";

const HOOKS_DIR = ".git/hooks";

// pre-commit 钩子内容
const preCommitHook = `#!/bin/sh
# 自动版本管理 - pre-commit hook
# 每次提交时自动增加 patch 版本号

echo "🔄 自动更新版本号 (patch)..."
node scripts/version-manager.js patch

# 将版本文件添加到当前提交
git add version.json package.json

echo "✅ 版本号已更新并添加到提交中"
`;

// pre-push 钩子内容
const prePushHook = `#!/bin/sh
# 自动版本管理 - pre-push hook
# 每次推送时自动增加 minor 版本号

echo "🔄 自动更新版本号 (minor)..."

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
  echo "⚠️ 检测到未提交的更改，跳过版本更新"
  exit 0
fi

# 更新版本号
node scripts/version-manager.js minor

# 检查版本文件是否有变化
if git diff --quiet version.json package.json; then
  echo "ℹ️ 版本号无变化，跳过提交"
  exit 0
fi

# 创建版本更新提交
git add version.json package.json
if git commit -m "chore: bump version to $(node -e "console.log(JSON.parse(require('fs').readFileSync('version.json', 'utf8')).version)")"; then
  echo "✅ 版本号已更新并提交"
else
  echo "❌ 版本提交失败，但推送将继续"
fi
`;

/**
 * 安装钩子文件
 * @param {string} hookName - 钩子名称
 * @param {string} content - 钩子内容
 */
function installHook(hookName, content) {
  const hookPath = path.join(HOOKS_DIR, hookName);

  try {
    // 检查 .git/hooks 目录是否存在
    if (!fs.existsSync(HOOKS_DIR)) {
      console.error("❌ .git/hooks 目录不存在，请确保在 Git 仓库中运行此脚本");
      process.exit(1);
    }

    // 写入钩子文件
    fs.writeFileSync(hookPath, content, { mode: 0o755 });
    console.log(`✅ ${hookName} 钩子已安装`);
  } catch (error) {
    console.error(
      `❌ 安装 ${hookName} 钩子失败:`,
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * 卸载钩子文件
 * @param {string} hookName - 钩子名称
 */
function uninstallHook(hookName) {
  const hookPath = path.join(HOOKS_DIR, hookName);

  try {
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
      console.log(`✅ ${hookName} 钩子已卸载`);
    } else {
      console.log(`ℹ️ ${hookName} 钩子不存在`);
    }
  } catch (error) {
    console.error(
      `❌ 卸载 ${hookName} 钩子失败:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
  case "install":
    console.log("🔧 安装 Git Hooks...");
    installHook("pre-commit", preCommitHook);
    installHook("pre-push", prePushHook);
    console.log("🎉 所有钩子安装完成！");
    console.log("");
    console.log("📋 自动版本管理规则:");
    console.log("   • git commit: 自动增加 patch 版本 (x.x.+1)");
    console.log("   • git push: 自动增加 minor 版本 (x.+1.0)");
    console.log(
      "   • 手动增加 major 版本: node scripts/version-manager.js major",
    );
    break;

  case "uninstall":
    console.log("🗑️ 卸载 Git Hooks...");
    uninstallHook("pre-commit");
    uninstallHook("pre-push");
    console.log("✅ 所有钩子已卸载");
    break;

  default:
    console.log("📖 Git Hooks 管理脚本使用说明:");
    console.log("   node scripts/install-hooks.js install    # 安装钩子");
    console.log("   node scripts/install-hooks.js uninstall  # 卸载钩子");
    break;
}

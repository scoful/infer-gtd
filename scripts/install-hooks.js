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
# 推送时进行 minor 版本更新（在推送前完成）

echo "🔄 准备推送，检查版本更新..."

# 检查版本文件是否有未提交的更改
if ! git diff-index --quiet HEAD -- version.json package.json; then
  echo "⚠️ 版本文件有未提交的更改，请先提交 version.json 和 package.json"
  exit 1
fi

# 检查是否有待推送的提交
if git diff --quiet HEAD @{upstream} 2>/dev/null; then
  echo "ℹ️ 没有新的提交需要推送"
  exit 0
fi

echo "🔄 更新 minor 版本号..."
node scripts/version-manager.js minor

# 检查版本文件是否有变化
if ! git diff --quiet version.json package.json; then
  # 有版本变化，需要创建新的提交
  git add version.json package.json

  if git commit -m "chore: bump version to $(node -e "console.log(JSON.parse(require('fs').readFileSync('version.json', 'utf8')).version)")"; then
    echo "✅ 版本号已更新并提交"
    echo "📤 新的版本提交将包含在此次推送中"
  else
    echo "❌ 版本提交失败，推送被取消"
    exit 1
  fi
else
  echo "ℹ️ 版本号无变化，继续推送"
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
    console.log("   • git push: 自动增加 minor 版本 (x.+1.0) 并包含在推送中");
    console.log(
      "   • 手动增加 major 版本: node scripts/version-manager.js major",
    );
    console.log("");
    console.log("⚠️ 重要提示:");
    console.log("   • push 时会自动创建版本更新提交并包含在推送中");
    console.log("   • 确保 version.json 和 package.json 没有未提交的更改");
    console.log("   • 其他文件可以保持未提交状态");
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

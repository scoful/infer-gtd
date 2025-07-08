#!/usr/bin/env node

/**
 * 版本管理脚本
 * 支持语义化版本控制的自动化管理
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const VERSION_FILE = "version.json";

/**
 * 读取版本文件
 */
function readVersionFile() {
  try {
    const content = fs.readFileSync(VERSION_FILE, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(
      "❌ 无法读取版本文件:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * 写入版本文件
 * @param {any} versionData - 版本数据对象
 */
function writeVersionFile(versionData) {
  try {
    const content = JSON.stringify(versionData, null, 2);
    fs.writeFileSync(VERSION_FILE, content, "utf8");
    console.log(`✅ 版本已更新: ${versionData.version}`);
  } catch (error) {
    console.error(
      "❌ 无法写入版本文件:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * 获取 Git 信息
 */
function getGitInfo() {
  try {
    const gitCommit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
    }).trim();
    const gitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
    return { gitCommit, gitBranch };
  } catch (error) {
    console.warn(
      "⚠️ 无法获取 Git 信息:",
      error instanceof Error ? error.message : String(error),
    );
    return { gitCommit: "", gitBranch: "" };
  }
}

/**
 * 更新版本号
 * @param {string} type - 版本类型 (patch|minor|major)
 */
function updateVersion(type) {
  const versionData = readVersionFile();
  const { gitCommit, gitBranch } = getGitInfo();

  // 更新版本号
  switch (type) {
    case "patch":
      versionData.patch += 1;
      break;
    case "minor":
      versionData.minor += 1;
      versionData.patch = 0;
      break;
    case "major":
      versionData.major += 1;
      versionData.minor = 0;
      versionData.patch = 0;
      break;
    default:
      console.error("❌ 无效的版本类型:", type);
      process.exit(1);
  }

  // 更新其他信息
  versionData.version = `${versionData.major}.${versionData.minor}.${versionData.patch}`;
  versionData.buildTime = new Date().toISOString();
  versionData.gitCommit = gitCommit;
  versionData.gitBranch = gitBranch;

  writeVersionFile(versionData);
  return versionData;
}

/**
 * 设置环境
 * @param {string} env - 环境名称
 */
function setEnvironment(env) {
  const versionData = readVersionFile();
  versionData.environment = env;
  versionData.buildTime = new Date().toISOString();

  const { gitCommit, gitBranch } = getGitInfo();
  versionData.gitCommit = gitCommit;
  versionData.gitBranch = gitBranch;

  writeVersionFile(versionData);
  return versionData;
}

/**
 * 显示当前版本
 */
function showVersion() {
  const versionData = readVersionFile();
  console.log("📋 当前版本信息:");
  console.log(`   版本号: ${versionData.version}`);
  console.log(`   构建时间: ${versionData.buildTime}`);
  console.log(`   Git 提交: ${versionData.gitCommit}`);
  console.log(`   Git 分支: ${versionData.gitBranch}`);
  console.log(`   环境: ${versionData.environment}`);
}

// 命令行参数处理
const command = process.argv[2];
const argument = process.argv[3];

switch (command) {
  case "patch":
  case "minor":
  case "major":
    updateVersion(command);
    break;
  case "set-env":
    if (!argument) {
      console.error("❌ 请指定环境名称");
      process.exit(1);
    }
    setEnvironment(argument);
    break;
  case "show":
    showVersion();
    break;
  default:
    console.log("📖 版本管理脚本使用说明:");
    console.log("   node scripts/version-manager.js patch    # 增加补丁版本");
    console.log("   node scripts/version-manager.js minor    # 增加次版本");
    console.log("   node scripts/version-manager.js major    # 增加主版本");
    console.log("   node scripts/version-manager.js set-env <env>  # 设置环境");
    console.log("   node scripts/version-manager.js show     # 显示当前版本");
    break;
}

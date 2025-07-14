/**
 * 管理员权限检查中间件
 *
 * 基于用户设置中的role字段进行权限验证
 */

import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";

/**
 * 检查用户是否为管理员
 */
export async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user?.settings) {
      return false; // 没有设置，默认为普通用户
    }

    const settings = JSON.parse(user.settings);
    return settings.role === "admin";
  } catch (error) {
    // 解析失败，默认为普通用户
    return false;
  }
}

/**
 * 管理员权限中间件工厂函数
 */
export function createAdminMiddleware() {
  return async function adminMiddleware(opts: {
    ctx: { session: { user: { id: string } } };
    next: () => Promise<any>;
  }) {
    const { ctx, next } = opts;

    // 检查用户是否为管理员
    const isAdmin = await checkAdminRole(ctx.session.user.id);

    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "需要管理员权限才能执行此操作",
      });
    }

    return next();
  };
}

/**
 * 获取用户角色
 */
export async function getUserRole(userId: string): Promise<"user" | "admin"> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user?.settings) {
      return "user"; // 默认为普通用户
    }

    const settings = JSON.parse(user.settings);
    return settings.role === "admin" ? "admin" : "user";
  } catch (error) {
    // 解析失败，默认为普通用户
    return "user";
  }
}

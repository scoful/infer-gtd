import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  generateRequestId,
  coreLoggers,
  logApiCall,
} from "@/utils/logger-core";

// 需要管理员权限的路径
const ADMIN_PATHS = [
  "/admin",
  "/admin/scheduler",
];

// 在中间件中不进行权限检查，因为Edge Runtime不支持Prisma
// 所有权限检查都交给AdminGuard组件处理

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = generateRequestId();
  const { pathname } = request.nextUrl;

  // 检查是否为管理员路径，记录访问日志
  const isAdminPath = ADMIN_PATHS.some(path =>
    pathname === path || pathname.startsWith(path + "/")
  );

  if (isAdminPath) {
    coreLoggers.middleware.info(
      { path: pathname, requestId },
      "管理员页面访问（权限检查由前端AdminGuard处理）"
    );
  }

  // 添加请求ID到响应头
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  // 记录API调用（仅对API路由）
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // 记录请求开始
    coreLoggers.middleware.debug(
      {
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        userAgent: request.headers.get("user-agent"),
        type: "request_start",
      },
      `API请求开始: ${request.method} ${request.nextUrl.pathname}`,
    );

    // 在响应完成后记录日志
    response.headers.set("x-log-request", "true");
    response.headers.set("x-request-start", start.toString());
    response.headers.set("x-request-id", requestId);
  }

  return response;
}

// 配置中间件匹配路径
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - 其他静态资源
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

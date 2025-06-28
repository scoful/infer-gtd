import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logApiCall, generateRequestId } from "@/utils/logger";

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = generateRequestId();

  // 添加请求ID到响应头
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  // 记录API调用（仅对API路由）
  if (request.nextUrl.pathname.startsWith("/api/")) {
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

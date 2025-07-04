import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "@/env";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { serverLoggers, logServerError } from "@/utils/logger-server";

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: ({ path, error, req }) => {
    const requestId =
      (req.headers["x-request-id"] as string) || `api_${Date.now()}`;

    logServerError(serverLoggers.trpc, error, {
      path: path ?? "<no-path>",
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
    });

    // 在开发环境也输出到控制台以便调试
    if (env.NODE_ENV === "development") {
      console.error(
        `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
      );
    }
  },
});

# iOS 14 兼容性问题修复指南

## 问题概述

在 iOS 14 Safari 上，Next.js + tRPC 项目出现以下问题：
1. **样式问题**：Tailwind CSS v4 的样式无法正常显示
2. **数据获取问题**：生产环境（`pnpm build` + `pnpm start` 或 Vercel 部署）无法获取 tRPC API 数据

## 问题根源

### 1. Tailwind CSS v4 兼容性问题

**原因**：
- Tailwind CSS v4 要求 Safari 16.4+（2023年3月发布）
- iOS 14 使用 Safari 14.x，不支持 v4 所需的现代 CSS 特性

**解决方案**：
- 降级到 Tailwind CSS v3.4.17（官方支持 Safari 14）

### 2. tRPC v10+ 兼容性问题

**原因**：
- tRPC v10.0.1+ 到 v11.x 在 iOS 14 Safari 的生产构建中存在兼容性问题
- 客户端的 `transformer` 配置位置在 v10 和 v11 中不同
- 错误的配置导致 SuperJSON 反序列化失败，数据结构异常

**解决方案**：
- 降级到 tRPC v10.0.0
- 修正客户端 `transformer` 配置位置

## 修复步骤

### 步骤 1：降级 Tailwind CSS

修改 `package.json`：

```json
{
  "dependencies": {
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

修改 `postcss.config.js`（从 `.mjs` 改为 `.js`）：

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

修改 `src/styles/globals.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

创建 `tailwind.config.ts`：

```typescript
import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

### 步骤 2：降级 tRPC 和 React Query

修改 `package.json`：

```json
{
  "dependencies": {
    "@trpc/client": "10.0.0",
    "@trpc/next": "10.0.0",
    "@trpc/react-query": "10.0.0",
    "@trpc/server": "10.0.0",
    "@tanstack/react-query": "^4.42.0"
  }
}
```

**注意**：
- tRPC v10 需要 `@tanstack/react-query` v4（v5 是为 tRPC v11 设计的）

### 步骤 3：修改服务器端 tRPC 配置

修改 `src/server/api/trpc.ts`：

```typescript
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

// v10.0.0 语法：使用 ReturnType
const t = initTRPC.context<ReturnType<typeof createTRPCContext>>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// v10.0.0 不支持 createCallerFactory
// export const createCallerFactory = t.createCallerFactory;
```

如果使用 Vercel（Turso），修改 `src/server/api/trpc-vercel.ts`：

```typescript
// 异步 context 需要使用 Awaited
const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });
```

### 步骤 4：修改客户端 tRPC 配置（关键！）

修改 `src/utils/api.ts`：

```typescript
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { type AppRouter } from "@/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      // ✅ 关键：在 config() 返回对象的顶层配置 transformer（v10 语法）
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // ❌ 不要在这里配置 transformer（这是 v11 语法）
        }),
      ],
    };
  },
  ssr: false,
});

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

**关键点**：
- ✅ **v10 语法**：`transformer` 在 `config()` 返回对象的顶层
- ❌ **v11 语法**：`transformer` 在 `httpBatchLink` 中或 `createTRPCNext` 外层

### 步骤 5：移除 createCallerFactory 引用

修改 `src/server/api/root.ts`：

```typescript
import { postRouter } from "@/server/api/routers/post";
import { statsRouter } from "@/server/api/routers/stats";
import { historyRouter } from "@/server/api/routers/history";
import { createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  stats: statsRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;

// v10.0.0 不支持 createCallerFactory
// export const createCaller = createCallerFactory(appRouter);
```

### 步骤 6：安装依赖并测试

```bash
# 清理旧依赖
rm -rf node_modules pnpm-lock.yaml .next

# 安装新依赖（跳过 rclone.js 的 postinstall 错误）
pnpm install --ignore-scripts

# 重新构建 better-sqlite3（如果使用本地数据库）
pnpm rebuild better-sqlite3

# 开发模式测试
pnpm dev

# 生产构建测试
pnpm build
pnpm start
```

## 验证修复

### 本地验证

1. **开发模式**：`pnpm dev`
   - 在 iOS 14 Safari 上访问
   - 检查样式是否正常
   - 检查数据是否能正常获取

2. **生产模式**：`pnpm build && pnpm start`
   - 在 iOS 14 Safari 上访问
   - 检查样式是否正常
   - 检查数据是否能正常获取

### Vercel 验证

1. 提交代码并推送到 GitHub
2. 等待 Vercel 自动部署
3. 在 iOS 14 Safari 上访问生产环境
4. 验证样式和数据获取

## 技术细节

### SuperJSON 序列化格式

**直接 fetch() 调用 tRPC API**：
```json
{
  "result": {
    "data": {
      "json": {
        "latestDates": { ... },
        "totalSystemRequests": 8512
      },
      "meta": { ... }
    }
  }
}
```

**使用 tRPC hooks（正确配置 transformer）**：
```typescript
// 自动反序列化，直接返回数据
const { data } = api.history.getDataOverview.useQuery();
// data.latestDates ✅
// data.totalSystemRequests ✅
```

### 为什么 transformer 配置位置很重要

- **v10**：客户端在 `config()` 返回对象中配置 `transformer`
- **v11**：客户端在 `httpBatchLink` 或 `createTRPCNext` 外层配置 `transformer`
- 配置位置错误会导致：
  - SuperJSON 反序列化失败
  - 数据结构异常（`latestDates` 等字段为 `undefined`）
  - iOS 14 Safari 在生产构建中无法获取数据

## 参考资料

- [Tailwind CSS v3 文档](https://v3.tailwindcss.com/)
- [tRPC v10 Data Transformers](https://trpc.io/docs/v10/data-transformers)
- [tRPC v10 Migration Guide](https://trpc.io/docs/v10/migrate-from-v9-to-v10)
- [SuperJSON 文档](https://github.com/blitz-js/superjson)

## 总结

iOS 14 兼容性问题的核心在于：
1. **Tailwind CSS v4** 不支持 Safari 14 → 降级到 v3.4.17
2. **tRPC v10.0.1+** 在 iOS 14 生产构建中有问题 → 降级到 v10.0.0
3. **transformer 配置位置错误** → 在 `config()` 返回对象的顶层配置

修复后，项目在 iOS 14 Safari 上的样式和数据获取都能正常工作。


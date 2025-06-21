# 项目代码规范文档

## 1. 项目概述

本项目基于 **T3 Stack** 脚手架生成，采用现代化的全栈开发技术栈：
- **Next.js 15** (App Router + Pages Router 混合模式)
- **TypeScript** (严格模式)
- **tRPC** (类型安全的API)
- **Prisma** (数据库ORM)
- **NextAuth.js** (身份认证)
- **Tailwind CSS v4** (样式框架)
- **pnpm** (包管理器)

## 2. 项目结构规范

### 2.1 目录结构
```
src/
├── app/                    # Next.js App Router (新功能)
│   └── api/               # App Router API路由
├── pages/                 # Next.js Pages Router (主要路由)
│   ├── _app.tsx          # 应用入口
│   ├── index.tsx         # 首页
│   └── api/              # Pages Router API路由
├── server/               # 服务端代码
│   ├── api/              # tRPC API定义
│   │   ├── root.ts       # API根路由
│   │   ├── trpc.ts       # tRPC配置
│   │   └── routers/      # API路由模块
│   ├── auth/             # 身份认证配置
│   └── db.ts             # 数据库连接
├── styles/               # 全局样式
├── utils/                # 工具函数
└── env.js                # 环境变量配置
```

### 2.2 文件命名规范
- **组件文件**: PascalCase (如 `UserProfile.tsx`)
- **页面文件**: kebab-case 或 camelCase (如 `index.tsx`, `user-profile.tsx`)
- **工具文件**: camelCase (如 `api.ts`, `formatDate.ts`)
- **配置文件**: kebab-case (如 `next.config.js`, `eslint.config.js`)
- **类型文件**: camelCase + `.types.ts` 后缀

## 3. TypeScript 编码规范

### 3.1 类型定义
```typescript
// ✅ 推荐：使用 interface 定义对象类型
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ 推荐：使用 type 定义联合类型
type Status = "pending" | "approved" | "rejected";

// ✅ 推荐：使用泛型增强类型安全
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
```

### 3.2 导入规范
```typescript
// ✅ 推荐：使用 type-only imports
import { type NextPage } from "next";
import { type Session } from "next-auth";

// ✅ 推荐：使用路径别名
import { api } from "@/utils/api";
import { db } from "@/server/db";
```

### 3.3 严格模式配置
- 启用 `strict: true`
- 启用 `noUncheckedIndexedAccess: true`
- 使用 `satisfies` 操作符确保类型安全

## 4. React 组件规范

### 4.1 函数组件定义
```typescript
// ✅ 推荐：使用函数声明
export default function HomePage() {
  return <div>Home Page</div>;
}

// ✅ 推荐：带类型的组件
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <p className="text-gray-600">{user.email}</p>
    </div>
  );
}
```

### 4.2 Hooks 使用规范
```typescript
// ✅ 推荐：自定义 Hook 命名以 use 开头
function useUserData(userId: string) {
  return api.user.getById.useQuery({ id: userId });
}

// ✅ 推荐：条件查询
const { data: secretMessage } = api.post.getSecretMessage.useQuery(
  undefined,
  { enabled: sessionData?.user !== undefined }
);
```

## 5. tRPC API 规范

### 5.1 路由定义
```typescript
// ✅ 推荐：使用 Zod 进行输入验证
export const postRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      content: z.string().min(1)
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          ...input,
          createdBy: { connect: { id: ctx.session.user.id } },
        },
      });
    }),
});
```

### 5.2 错误处理
```typescript
// ✅ 推荐：使用 TRPCError 抛出错误
if (!post) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Post not found",
  });
}
```

## 6. 样式规范 (Tailwind CSS)

### 6.1 类名组织
```typescript
// ✅ 推荐：按功能分组类名
<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
  <button className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20">
    Click me
  </button>
</div>
```

### 6.2 响应式设计
```typescript
// ✅ 推荐：移动优先的响应式设计
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
  <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
    Title
  </h1>
</div>
```

## 7. 数据库规范 (Prisma)

### 7.1 模型定义
```prisma
model Post {
    id        Int      @id @default(autoincrement())
    title     String
    content   String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    createdBy   User   @relation(fields: [createdById], references: [id])
    createdById String

    @@index([title])
    @@index([createdById])
}
```

### 7.2 查询规范
```typescript
// ✅ 推荐：使用类型安全的查询
const posts = await ctx.db.post.findMany({
  where: { createdById: ctx.session.user.id },
  orderBy: { createdAt: "desc" },
  include: { createdBy: true },
});
```

## 8. 环境配置规范

### 8.1 环境变量
```typescript
// ✅ 推荐：使用 @t3-oss/env-nextjs 进行类型安全的环境变量
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
});
```

## 9. 代码格式化规范

### 9.1 Prettier 配置
- 使用 `prettier-plugin-tailwindcss` 自动排序 Tailwind 类名
- 默认配置，无需额外自定义

### 9.2 ESLint 规则
- 使用 TypeScript ESLint 推荐配置
- 启用 `consistent-type-imports` 强制类型导入
- 启用 `no-unused-vars` 检查未使用变量

## 10. 最佳实践

### 10.1 性能优化
- 使用 `next/dynamic` 进行代码分割
- 合理使用 React Query 的缓存机制
- 避免不必要的重新渲染

### 10.2 安全性
- 始终验证用户输入 (使用 Zod)
- 使用 `protectedProcedure` 保护需要认证的 API
- 环境变量不要包含敏感信息在客户端

### 10.3 可维护性
- 保持组件单一职责
- 使用有意义的变量和函数名
- 添加适当的注释和文档
- 定期重构和优化代码

## 11. 开发工作流

### 11.1 Git 提交规范
```bash
feat: 添加用户管理功能
fix: 修复登录状态异常
docs: 更新API文档
style: 调整按钮样式
refactor: 重构用户服务
test: 添加用户测试用例
```

### 11.2 开发命令
```bash
pnpm dev          # 开发模式
pnpm build        # 构建生产版本
pnpm lint         # 代码检查
pnpm format:write # 格式化代码
pnpm typecheck    # 类型检查
```

## 12. 具体代码示例和模板

### 12.1 页面组件模板
```typescript
import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { api } from "@/utils/api";

interface PageProps {
  // 定义页面属性
}

const PageName: NextPage<PageProps> = () => {
  const { data: sessionData } = useSession();

  // API 调用
  const { data, isLoading, error } = api.example.getData.useQuery();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <>
      <Head>
        <title>页面标题 | Smart GTD</title>
        <meta name="description" content="页面描述" />
      </Head>
      <main className="container mx-auto px-4 py-8">
        {/* 页面内容 */}
      </main>
    </>
  );
};

export default PageName;
```

### 12.2 tRPC 路由模板
```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

// 输入验证 Schema
const createInputSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
  description: z.string().optional(),
});

const updateInputSchema = createInputSchema.extend({
  id: z.string().cuid("无效的ID格式"),
});

export const exampleRouter = createTRPCRouter({
  // 公开查询
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.example.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return { items, nextCursor };
    }),

  // 受保护的创建操作
  create: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.example.create({
          data: {
            ...input,
            createdById: ctx.session.user.id,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "创建失败",
          cause: error,
        });
      }
    }),

  // 受保护的更新操作
  update: protectedProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // 验证所有权
      const existing = await ctx.db.example.findUnique({
        where: { id },
        select: { createdById: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "记录不存在",
        });
      }

      if (existing.createdById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权限修改此记录",
        });
      }

      return await ctx.db.example.update({
        where: { id },
        data: updateData,
      });
    }),

  // 受保护的删除操作
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // 类似的所有权验证逻辑
      const existing = await ctx.db.example.findUnique({
        where: { id: input.id },
        select: { createdById: true },
      });

      if (!existing || existing.createdById !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "记录不存在或无权限删除",
        });
      }

      await ctx.db.example.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
```

### 12.3 自定义 Hook 模板
```typescript
import { useState, useCallback } from "react";
import { api } from "@/utils/api";
import { type RouterOutputs } from "@/utils/api";

type ExampleItem = RouterOutputs["example"]["getAll"]["items"][0];

export function useExampleManagement() {
  const [selectedItem, setSelectedItem] = useState<ExampleItem | null>(null);

  const utils = api.useUtils();

  // 查询
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
  } = api.example.getAll.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // 创建
  const createMutation = api.example.create.useMutation({
    onSuccess: () => {
      void utils.example.getAll.invalidate();
    },
    onError: (error) => {
      console.error("创建失败:", error.message);
    },
  });

  // 更新
  const updateMutation = api.example.update.useMutation({
    onSuccess: () => {
      void utils.example.getAll.invalidate();
      setSelectedItem(null);
    },
  });

  // 删除
  const deleteMutation = api.example.delete.useMutation({
    onSuccess: () => {
      void utils.example.getAll.invalidate();
    },
  });

  const handleCreate = useCallback((data: Parameters<typeof createMutation.mutate>[0]) => {
    createMutation.mutate(data);
  }, [createMutation]);

  const handleUpdate = useCallback((data: Parameters<typeof updateMutation.mutate>[0]) => {
    updateMutation.mutate(data);
  }, [updateMutation]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await showConfirm({
      title: "确认删除",
      message: "确定要删除这个项目吗？删除后无法恢复。",
      confirmText: "删除",
      cancelText: "取消",
      type: "danger",
    });

    if (confirmed) {
      deleteMutation.mutate({ id });
    }
  }, [deleteMutation, showConfirm]);

  return {
    // 数据
    data,
    isLoading,
    error,
    selectedItem,

    // 分页
    fetchNextPage,
    hasNextPage,

    // 操作
    handleCreate,
    handleUpdate,
    handleDelete,
    setSelectedItem,

    // 状态
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
```

### 12.4 Prisma 模型模板
```prisma
model Example {
    id          String   @id @default(cuid())
    title       String
    description String?
    status      Status   @default(DRAFT)
    priority    Priority @default(MEDIUM)

    // 时间戳
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    // 关联关系
    createdBy   User   @relation(fields: [createdById], references: [id], onDelete: Cascade)
    createdById String

    tags        Tag[]
    attachments Attachment[]

    // 索引
    @@index([createdById])
    @@index([status])
    @@index([createdAt])
    @@index([title])
}

enum Status {
    DRAFT
    PUBLISHED
    ARCHIVED
}

enum Priority {
    LOW
    MEDIUM
    HIGH
    URGENT
}
```

## 13. 错误处理规范

### 13.1 客户端错误处理
```typescript
import { TRPCClientError } from "@trpc/client";
import { type AppRouter } from "@/server/api/root";

function handleTRPCError(error: TRPCClientError<AppRouter>) {
  if (error.data?.code === "UNAUTHORIZED") {
    // 重定向到登录页
    void signIn();
    return;
  }

  if (error.data?.code === "FORBIDDEN") {
    // 显示权限错误
    toast.error("您没有权限执行此操作");
    return;
  }

  if (error.data?.zodError) {
    // 处理验证错误
    const fieldErrors = error.data.zodError.fieldErrors;
    Object.entries(fieldErrors).forEach(([field, messages]) => {
      toast.error(`${field}: ${messages?.[0] ?? "验证失败"}`);
    });
    return;
  }

  // 通用错误处理
  toast.error(error.message || "操作失败，请稍后重试");
}
```

### 13.2 服务端错误处理
```typescript
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        throw new TRPCError({
          code: "CONFLICT",
          message: "该记录已存在",
        });
      case "P2025":
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "记录不存在",
        });
      default:
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "数据库操作失败",
        });
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "未知错误",
    cause: error,
  });
}
```

## 14. 测试规范

### 14.1 单元测试模板
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createCaller } from "@/server/api/root";
import { createInnerTRPCContext } from "@/server/api/trpc";

describe("example router", () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    const ctx = createInnerTRPCContext({
      session: {
        user: { id: "test-user-id" },
        expires: new Date().toISOString(),
      },
    });
    caller = createCaller(ctx);
  });

  it("should create example", async () => {
    const input = {
      title: "Test Example",
      description: "Test Description",
    };

    const result = await caller.example.create(input);

    expect(result).toMatchObject({
      title: input.title,
      description: input.description,
      createdById: "test-user-id",
    });
  });
});
```

---

**注意**: 本规范基于 T3 Stack v7.39.3 生成，应根据项目发展持续更新和完善。

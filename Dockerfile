# 多阶段构建 Dockerfile for Next.js + tRPC + Prisma 应用
# 优化 CI/CD 构建和生产部署

# 基础镜像
FROM node:20-alpine AS base

# 安装必要的系统依赖
RUN apk add --no-cache libc6-compat curl

# 安装 pnpm
RUN npm install -g pnpm@9.6.0

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 依赖安装阶段
FROM base AS deps

# 安装依赖（跳过 postinstall 脚本）
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

# 构建阶段
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN pnpm prisma generate

# 设置构建环境变量
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN pnpm build

# 生产运行阶段
FROM node:20-alpine AS runner

# 安装运行时依赖
RUN apk add --no-cache curl

# 安装 pnpm（用于 Prisma 客户端生成）
RUN npm install -g pnpm@9.6.0

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制 Prisma 相关文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# 安装 Prisma 客户端（仅生产依赖）
RUN pnpm add @prisma/client prisma --prod

# 生成 Prisma 客户端
RUN pnpm prisma generate

# 设置文件权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 添加构建信息标签
ARG BUILD_DATE
ARG VCS_REF
LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.title="GTD Task Management System" \
      org.opencontainers.image.description="Next.js + tRPC + Prisma GTD Application"

# 启动命令
CMD ["node", "server.js"]

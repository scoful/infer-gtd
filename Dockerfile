# 多阶段构建 Dockerfile for Next.js + tRPC + Prisma 应用
# 优化 CI/CD 构建和生产部署
#
# 构建参数说明：
# - USE_CHINA_MIRROR: 是否使用国内镜像源加速（默认false，适合GitHub Actions）
#   本地构建时可设置为true: docker build --build-arg USE_CHINA_MIRROR=true .
#   GitHub Actions构建时保持默认: docker build .

# 基础镜像
FROM node:20-alpine AS base

# 构建参数：是否使用国内镜像源（默认不使用，适合GitHub Actions）
ARG USE_CHINA_MIRROR=false

# 安装必要的系统依赖
RUN apk add --no-cache libc6-compat curl

# 根据构建参数配置 npm 镜像源并安装 pnpm
RUN if [ "$USE_CHINA_MIRROR" = "true" ]; then \
        npm config set registry https://registry.npmmirror.com; \
    fi && \
    npm install -g pnpm@9.6.0

# 设置工作目录
WORKDIR /app

# 设置 pnpm 环境变量
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 复制 package 文件和配置
COPY package.json pnpm-lock.yaml .npmrc ./

# 依赖安装阶段
FROM base AS deps

# 传递构建参数
ARG USE_CHINA_MIRROR=false

# 根据构建参数配置 pnpm 镜像源并安装依赖
RUN if [ "$USE_CHINA_MIRROR" = "true" ]; then \
        pnpm config set registry https://registry.npmmirror.com; \
    fi && \
    pnpm config set store-dir ~/.pnpm-store && \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts

# 构建阶段
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 生成 Prisma 客户端
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
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
RUN apk add --no-cache curl netcat-openbsd

# 传递构建参数
ARG USE_CHINA_MIRROR=false

# 根据构建参数配置 npm 镜像源并安装 pnpm（用于 Prisma 客户端生成）
RUN if [ "$USE_CHINA_MIRROR" = "true" ]; then \
        npm config set registry https://registry.npmmirror.com; \
    fi && \
    npm install -g pnpm@9.6.0

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 注释：使用 root 用户运行以避免权限问题
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 复制 Prisma 相关文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# 复制启动脚本
COPY scripts/docker-entrypoint.sh ./scripts/
RUN chmod +x ./scripts/docker-entrypoint.sh

# 传递构建参数
ARG USE_CHINA_MIRROR=false

# 根据构建参数配置 pnpm 镜像源并安装 Prisma 相关包
RUN if [ "$USE_CHINA_MIRROR" = "true" ]; then \
        pnpm config set registry https://registry.npmmirror.com; \
    fi && \
    pnpm add @prisma/client prisma --prod

# 生成 Prisma 客户端
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate

# 创建日志目录
RUN mkdir -p /app/logs

# 注释：使用 root 用户运行，无需切换用户
# USER nextjs

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

# 设置入口点和启动命令
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]

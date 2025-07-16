# 多阶段构建 Dockerfile for Next.js + tRPC + Prisma 应用
# 优化 CI/CD 构建和生产部署
#
# 构建参数说明：
# - USE_CHINA_MIRROR: 是否使用国内镜像源加速（默认false，适合GitHub Actions）
#   本地构建时可设置为true: docker build --build-arg USE_CHINA_MIRROR=true .
#   GitHub Actions构建时保持默认: docker build .
#
# 时区设置：
# - 默认使用中国时区 (Asia/Shanghai)
# - 可通过环境变量覆盖: docker run -e TZ=UTC your-image

# 基础镜像
FROM node:20-alpine AS base

# 构建参数：是否使用国内镜像源（默认不使用，适合GitHub Actions）
ARG USE_CHINA_MIRROR=false

# 安装必要的系统依赖和时区数据
RUN apk add --no-cache libc6-compat curl tzdata

# 设置时区环境变量（默认为中国时区）
ENV TZ=Asia/Shanghai

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

# 注释：移除prod-deps阶段，standalone模式已包含所需依赖

# 构建阶段
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 设置生产环境版本信息
RUN node scripts/version-manager.js set-env production

# 生成 Prisma 客户端
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN pnpm prisma generate

# 设置构建环境变量
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN pnpm build

# 清理构建缓存和不必要的文件
RUN rm -rf .next/cache && \
    rm -rf node_modules/.cache && \
    rm -rf ~/.pnpm-store

# 生产运行阶段
FROM node:20-alpine AS runner

# 安装运行时依赖（最小化）和时区数据
RUN apk add --no-cache curl netcat-openbsd tzdata && \
    rm -rf /var/cache/apk/*

# 设置时区环境变量（可通过docker run -e TZ=xxx覆盖）
ENV TZ=Asia/Shanghai

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 注释：使用 root 用户运行以避免权限问题
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 复制构建产物 - 使用standalone自包含模式
COPY --from=builder /app/public ./public
COPY --from=builder --chown=root:root /app/.next/standalone ./
COPY --from=builder --chown=root:root /app/.next/static ./.next/static

# 复制 Prisma 相关文件（standalone模式需要）
COPY --from=builder /app/prisma ./prisma

# 复制版本信息文件
COPY --from=builder /app/version.json ./public/version.json

# 复制启动脚本和管理员设置脚本
COPY scripts/docker-entrypoint.sh ./scripts/
COPY scripts/setup-admin.js ./scripts/
RUN chmod +x ./scripts/docker-entrypoint.sh

# 生成 Prisma 客户端（使用standalone中的依赖）
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN cd /app && npx prisma generate

# 创建日志目录并清理不必要的文件
RUN mkdir -p /app/logs && \
    rm -rf /tmp/* /var/tmp/* && \
    npm cache clean --force 2>/dev/null || true

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

# 设置入口点和启动命令 - 使用standalone模式的server.js
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]

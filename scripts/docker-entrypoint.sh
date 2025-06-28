#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

# 注意：不使用 set -e，因为我们需要手动处理错误

# 创建状态文件目录
mkdir -p /tmp/app-status

echo "$(date -Iseconds) [INFO] [DOCKER] 🚀 Starting GTD Application..."
echo "STARTING" > /tmp/app-status/startup.status

# 检查数据库连接
echo "$(date -Iseconds) [INFO] [DOCKER] 📡 Checking database connection..."
echo "DB_CONNECTING" > /tmp/app-status/startup.status
npx prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1 || {
    echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Database connection failed"
    echo "DB_FAILED" > /tmp/app-status/startup.status
    exit 1
}
echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database connected successfully"
echo "DB_CONNECTED" > /tmp/app-status/startup.status

# 执行数据库迁移
echo "$(date -Iseconds) [INFO] [DOCKER] 🔄 Running database migrations..."
echo "MIGRATING" > /tmp/app-status/startup.status
MIGRATION_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    if echo "$MIGRATION_OUTPUT" | grep -q "P3005"; then
        echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Database schema exists but no migration history found"
        echo "$(date -Iseconds) [INFO] [DOCKER] 🔄 Resetting database and applying migrations..."
        echo "RESETTING_DB" > /tmp/app-status/startup.status
        npx prisma migrate reset --force || {
            echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Database reset failed"
            echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
            exit 1
        }
        echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database reset and migrations completed"
    else
        echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Database migration failed:"
        echo "$MIGRATION_OUTPUT"
        echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
        exit 1
    fi
else
    echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database migrations completed"
fi
echo "MIGRATED" > /tmp/app-status/startup.status

# 生成 Prisma 客户端
echo "$(date -Iseconds) [INFO] [DOCKER] ⚙️ Generating Prisma client..."
echo "GENERATING_CLIENT" > /tmp/app-status/startup.status
npx prisma generate || {
    echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Prisma client generation failed"
    echo "CLIENT_FAILED" > /tmp/app-status/startup.status
    exit 1
}

echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database setup completed successfully"
echo "DB_READY" > /tmp/app-status/startup.status

# 启动应用
echo "$(date -Iseconds) [INFO] [DOCKER] 🎯 Starting Next.js application..."
echo "APP_STARTING" > /tmp/app-status/startup.status

# 启动应用进程
"$@" &
APP_PID=$!

# 在后台监控应用启动状态
{
    # 等待应用启动完成（通过检查端口）
    for i in $(seq 1 30); do
        if nc -z localhost 3000 2>/dev/null; then
            echo "READY" > /tmp/app-status/startup.status
            echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Application is ready and listening on port 3000"
            break
        fi
        sleep 2
    done

    # 如果 30 次检查后仍未就绪，标记为失败
    if ! nc -z localhost 3000 2>/dev/null; then
        echo "APP_FAILED" > /tmp/app-status/startup.status
        echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Application failed to start within 60 seconds"
    fi
} &

# 等待应用主进程
wait $APP_PID

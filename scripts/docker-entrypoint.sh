#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

# 注意：不使用 set -e，因为我们需要手动处理错误

# 创建状态文件目录
mkdir -p /tmp/app-status

echo "🚀 Starting GTD Application..."
echo "STARTING" > /tmp/app-status/startup.status

# 检查数据库连接
echo "📡 Checking database connection..."
echo "DB_CONNECTING" > /tmp/app-status/startup.status
npx prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1 || {
    echo "❌ Database connection failed"
    echo "DB_FAILED" > /tmp/app-status/startup.status
    exit 1
}
echo "DB_CONNECTED" > /tmp/app-status/startup.status

# 执行数据库迁移
echo "🔄 Running database migrations..."
echo "MIGRATING" > /tmp/app-status/startup.status
MIGRATION_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    if echo "$MIGRATION_OUTPUT" | grep -q "P3005"; then
        echo "⚠️ Database schema exists but no migration history found"
        echo "🔄 Resetting database and applying migrations..."
        echo "RESETTING_DB" > /tmp/app-status/startup.status
        npx prisma migrate reset --force || {
            echo "❌ Database reset failed"
            echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
            exit 1
        }
        echo "✅ Database reset and migrations completed"
    else
        echo "❌ Database migration failed:"
        echo "$MIGRATION_OUTPUT"
        echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
        exit 1
    fi
else
    echo "✅ Database migrations completed"
fi
echo "MIGRATED" > /tmp/app-status/startup.status

# 生成 Prisma 客户端
echo "⚙️ Generating Prisma client..."
echo "GENERATING_CLIENT" > /tmp/app-status/startup.status
npx prisma generate || {
    echo "❌ Prisma client generation failed"
    echo "CLIENT_FAILED" > /tmp/app-status/startup.status
    exit 1
}

echo "✅ Database setup completed successfully"
echo "DB_READY" > /tmp/app-status/startup.status

# 启动应用
echo "🎯 Starting Next.js application..."
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
            echo "✅ Application is ready and listening on port 3000"
            break
        fi
        sleep 2
    done

    # 如果 30 次检查后仍未就绪，标记为失败
    if ! nc -z localhost 3000 2>/dev/null; then
        echo "APP_FAILED" > /tmp/app-status/startup.status
        echo "❌ Application failed to start within 60 seconds"
    fi
} &

# 等待应用主进程
wait $APP_PID

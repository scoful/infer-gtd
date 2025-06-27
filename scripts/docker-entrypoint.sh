#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

set -e

echo "🚀 Starting GTD Application..."

# 检查数据库连接
echo "📡 Checking database connection..."
npx prisma db push --accept-data-loss || {
    echo "❌ Database connection failed"
    exit 1
}

# 执行数据库迁移
echo "🔄 Running database migrations..."
npx prisma migrate deploy || {
    echo "❌ Database migration failed"
    exit 1
}

# 生成 Prisma 客户端（确保最新）
echo "⚙️ Generating Prisma client..."
npx prisma generate || {
    echo "❌ Prisma client generation failed"
    exit 1
}

# 可选：数据库种子（如果需要）
if [ "$RUN_SEED" = "true" ]; then
    echo "🌱 Running database seed..."
    npx prisma db seed || {
        echo "⚠️ Database seed failed (continuing anyway)"
    }
fi

echo "✅ Database setup completed successfully"

# 启动应用
echo "🎯 Starting Next.js application..."
exec "$@"

#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

set -e

echo "🚀 Starting GTD Application..."

# 检查数据库连接
echo "📡 Checking database connection..."
npx prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1 || {
    echo "❌ Database connection failed"
    exit 1
}

# 执行数据库迁移
echo "🔄 Running database migrations..."
npx prisma migrate deploy || {
    echo "❌ Database migration failed"
    exit 1
}

# 生成 Prisma 客户端
echo "⚙️ Generating Prisma client..."
npx prisma generate || {
    echo "❌ Prisma client generation failed"
    exit 1
}

echo "✅ Database setup completed successfully"

# 启动应用
echo "🎯 Starting Next.js application..."
exec "$@"

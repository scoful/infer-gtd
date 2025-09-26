#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

# 注意：不使用 set -e，因为我们需要手动处理错误

# 创建状态文件目录
mkdir -p /tmp/app-status

# 配置 npx 使用中国镜像源（如果设置了环境变量）
if [ "${USE_CHINA_MIRROR}" = "true" ]; then
    export NPX_REGISTRY="--registry https://registry.npmmirror.com/"
else
    export NPX_REGISTRY=""
fi

echo "$(date -Iseconds) [INFO] [DOCKER] 🚀 Starting GTD Application..."
echo "STARTING" > /tmp/app-status/startup.status

# 确保日志目录存在
LOG_DIR="${LOG_DIR:-/app/logs}"
mkdir -p "$LOG_DIR"
echo "$(date -Iseconds) [INFO] [DOCKER] 📁 Log directory ready: $LOG_DIR"

# 辅助函数：解析迁移错误并提取迁移名称
extract_migration_name_from_error() {
    local error_output="$1"
    # 尝试多种方式提取迁移名称
    local migration_name=""

    # 方式1: 从 "Migration name:" 行提取
    migration_name=$(echo "$error_output" | grep "Migration name:" | sed 's/Migration name: //' | tr -d '\n\r')

    # 方式2: 从错误消息中的路径提取
    if [ -z "$migration_name" ]; then
        migration_name=$(echo "$error_output" | grep -o '[0-9]\{14\}_[a-zA-Z0-9_]*' | head -1)
    fi

    # 方式3: 从 Applying migration 行提取
    if [ -z "$migration_name" ]; then
        migration_name=$(echo "$error_output" | grep "Applying migration" | sed 's/.*Applying migration `\([^`]*\)`.*/\1/' | tr -d '\n\r')
    fi

    echo "$migration_name"
}

# 辅助函数：通用检查迁移是否已在数据库中应用
check_migration_applied_in_db() {
    local migration_name="$1"

    echo "$(date -Iseconds) [INFO] [DOCKER] 🔍 Attempting to verify if migration changes exist in database..."

    # 方法1: 检查迁移文件并尝试解析其内容
    local migration_file="prisma/migrations/$migration_name/migration.sql"

    if [ -f "$migration_file" ]; then
        echo "$(date -Iseconds) [INFO] [DOCKER] 📄 Analyzing migration file: $migration_file"

        # 读取迁移文件内容
        local migration_content=$(cat "$migration_file")

        # 检查是否包含 ALTER TABLE ADD COLUMN 语句
        if echo "$migration_content" | grep -q "ALTER TABLE.*ADD COLUMN"; then
            echo "$(date -Iseconds) [INFO] [DOCKER] 🔍 Detected ADD COLUMN operation, checking if already applied..."

            # 提取表名和列名（简单解析）
            local table_column_info=$(echo "$migration_content" | grep "ALTER TABLE.*ADD COLUMN" | head -1)
            echo "$(date -Iseconds) [INFO] [DOCKER] 📝 Checking: $table_column_info"

            # 尝试重新执行 ADD COLUMN 语句来检查是否已存在
            local add_column_result=$(echo "$migration_content" | npx $NPX_REGISTRY prisma db execute --stdin --schema=prisma/schema.prisma 2>&1 || echo "EXECUTION_FAILED")

            if echo "$add_column_result" | grep -q "already exists\|duplicate column"; then
                echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Column already exists - migration appears to be applied"
                return 0
            elif echo "$add_column_result" | grep -q "EXECUTION_FAILED"; then
                echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Could not execute migration check"
                return 1
            else
                echo "$(date -Iseconds) [INFO] [DOCKER] ❌ Migration changes do not exist in database"
                return 1
            fi
        else
            echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Migration type not recognized for automatic verification"
            echo "$(date -Iseconds) [WARN] [DOCKER] Migration content preview:"
            echo "$migration_content" | head -5
            return 1
        fi
    else
        echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Migration file not found: $migration_file"
        echo "$(date -Iseconds) [WARN] [DOCKER] Cannot verify migration status"
        return 1
    fi
}

# 检查数据库连接
echo "$(date -Iseconds) [INFO] [DOCKER] 📡 Checking database connection..."
echo "DB_CONNECTING" > /tmp/app-status/startup.status

# 使用更安全的连接检查方式，避免意外修改数据库结构
DB_CHECK_OUTPUT=$(echo "SELECT 1;" | npx $NPX_REGISTRY prisma db execute --stdin --schema=prisma/schema.prisma 2>&1)
DB_CHECK_EXIT_CODE=$?

if [ $DB_CHECK_EXIT_CODE -ne 0 ]; then
    echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Database connection failed:"
    echo "$DB_CHECK_OUTPUT"
    echo "DB_FAILED" > /tmp/app-status/startup.status
    exit 1
fi

echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database connected successfully"
echo "DB_CONNECTED" > /tmp/app-status/startup.status

# 检查迁移状态
echo "$(date -Iseconds) [INFO] [DOCKER] 🔍 Checking migration status..."
MIGRATION_STATUS_OUTPUT=$(npx $NPX_REGISTRY prisma migrate status 2>&1)
MIGRATION_STATUS_EXIT_CODE=$?

echo "$(date -Iseconds) [INFO] [DOCKER] Current migration status:"
echo "$MIGRATION_STATUS_OUTPUT"

# 执行数据库迁移
echo "$(date -Iseconds) [INFO] [DOCKER] 🔄 Running database migrations..."
echo "MIGRATING" > /tmp/app-status/startup.status
MIGRATION_OUTPUT=$(npx $NPX_REGISTRY prisma migrate deploy 2>&1)
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    if echo "$MIGRATION_OUTPUT" | grep -q "P3005"; then
        echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Database schema exists but no migration history found"
        echo "$(date -Iseconds) [INFO] [DOCKER] 🔄 Resetting database and applying migrations..."
        echo "RESETTING_DB" > /tmp/app-status/startup.status
        npx $NPX_REGISTRY prisma migrate reset --force || {
            echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Database reset failed"
            echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
            exit 1
        }
        echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Database reset and migrations completed"
    elif echo "$MIGRATION_OUTPUT" | grep -q "P3018"; then
        echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Migration conflict detected - schema changes already applied"
        echo "$(date -Iseconds) [INFO] [DOCKER] 🔧 Attempting to resolve migration state..."
        echo "RESOLVING_MIGRATION" > /tmp/app-status/startup.status

        # 提取迁移名称
        MIGRATION_NAME=$(extract_migration_name_from_error "$MIGRATION_OUTPUT")

        if [ -n "$MIGRATION_NAME" ]; then
            echo "$(date -Iseconds) [INFO] [DOCKER] 📝 Detected problematic migration: $MIGRATION_NAME"

            # 检查迁移是否已在数据库中实际应用
            if check_migration_applied_in_db "$MIGRATION_NAME"; then
                echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Migration changes already exist in database"
                echo "$(date -Iseconds) [INFO] [DOCKER] 🔧 Marking migration as applied in migration history..."

                # 标记迁移为已应用
                RESOLVE_OUTPUT=$(npx $NPX_REGISTRY prisma migrate resolve --applied "$MIGRATION_NAME" 2>&1)
                RESOLVE_EXIT_CODE=$?

                if [ $RESOLVE_EXIT_CODE -eq 0 ]; then
                    echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Migration $MIGRATION_NAME marked as applied"

                    # 再次尝试应用剩余的迁移
                    echo "$(date -Iseconds) [INFO] [DOCKER] 🔄 Applying remaining migrations..."
                    MIGRATION_OUTPUT=$(npx $NPX_REGISTRY prisma migrate deploy 2>&1)
                    MIGRATION_EXIT_CODE=$?

                    if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
                        echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Failed to apply remaining migrations:"
                        echo "$MIGRATION_OUTPUT"
                        echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
                        exit 1
                    fi
                else
                    echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Failed to mark migration as applied:"
                    echo "$RESOLVE_OUTPUT"
                    echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
                    exit 1
                fi
            else
                echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Migration changes not found in database, but migration failed"
                echo "$(date -Iseconds) [ERROR] [DOCKER] This indicates a more serious database inconsistency"
                echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
                exit 1
            fi
        else
            echo "$(date -Iseconds) [ERROR] [DOCKER] ❌ Could not extract migration name from error output"
            echo "$(date -Iseconds) [ERROR] [DOCKER] Error output was:"
            echo "$MIGRATION_OUTPUT"
            echo "MIGRATION_FAILED" > /tmp/app-status/startup.status
            exit 1
        fi
        echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Migration conflict resolved successfully"
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
npx $NPX_REGISTRY prisma@6.9.0 generate || {
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

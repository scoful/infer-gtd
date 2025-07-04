#!/bin/sh

# Docker 容器启动脚本
# 处理 Prisma 数据库迁移和应用启动

# 注意：不使用 set -e，因为我们需要手动处理错误

# 创建状态文件目录
mkdir -p /tmp/app-status

echo "$(date -Iseconds) [INFO] [DOCKER] 🚀 Starting GTD Application..."
echo "STARTING" > /tmp/app-status/startup.status

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

# 辅助函数：检查迁移是否已在数据库中应用（通过检查实际的数据库结构）
check_migration_applied_in_db() {
    local migration_name="$1"

    echo "$(date -Iseconds) [INFO] [DOCKER] 🔍 Checking if migration changes exist in database..."

    # 根据迁移名称检查对应的数据库变更是否已存在
    case "$migration_name" in
        *"add_note_pin_feature"*)
            # 检查 isPinned 列是否存在
            local column_check=$(npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name = 'Note' AND column_name = 'isPinned';" 2>/dev/null | grep -c "isPinned" || echo "0")
            if [ "$column_check" -gt 0 ]; then
                echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Found isPinned column in Note table"
                return 0
            else
                echo "$(date -Iseconds) [INFO] [DOCKER] ❌ isPinned column not found in Note table"
                return 1
            fi
            ;;
        *"add_task_tag_sort_order"*)
            # 检查 sortOrder 列是否存在于 TaskTag 表
            local column_check=$(npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name = 'TaskTag' AND column_name = 'sortOrder';" 2>/dev/null | grep -c "sortOrder" || echo "0")
            if [ "$column_check" -gt 0 ]; then
                echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Found sortOrder column in TaskTag table"
                return 0
            else
                echo "$(date -Iseconds) [INFO] [DOCKER] ❌ sortOrder column not found in TaskTag table"
                return 1
            fi
            ;;
        *"add_note_summary"*)
            # 检查 summary 列是否存在于 Note 表
            local column_check=$(npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name = 'Note' AND column_name = 'summary';" 2>/dev/null | grep -c "summary" || echo "0")
            if [ "$column_check" -gt 0 ]; then
                echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Found summary column in Note table"
                return 0
            else
                echo "$(date -Iseconds) [INFO] [DOCKER] ❌ summary column not found in Note table"
                return 1
            fi
            ;;
        *)
            # 对于其他迁移，尝试通用检查方法
            echo "$(date -Iseconds) [WARN] [DOCKER] ⚠️ Unknown migration type: $migration_name"
            echo "$(date -Iseconds) [WARN] [DOCKER] Cannot verify if changes are applied, assuming they are not"
            return 1
            ;;
    esac
}

# 检查数据库连接
echo "$(date -Iseconds) [INFO] [DOCKER] 📡 Checking database connection..."
echo "DB_CONNECTING" > /tmp/app-status/startup.status

# 使用更安全的连接检查方式，避免意外修改数据库结构
DB_CHECK_OUTPUT=$(npx prisma db execute --stdin <<< "SELECT 1;" 2>&1)
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
MIGRATION_STATUS_OUTPUT=$(npx prisma migrate status 2>&1)
MIGRATION_STATUS_EXIT_CODE=$?

echo "$(date -Iseconds) [INFO] [DOCKER] Current migration status:"
echo "$MIGRATION_STATUS_OUTPUT"

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
                echo "$(date -Iseconds) [INFO] [DOCKER] � Marking migration as applied in migration history..."

                # 标记迁移为已应用
                RESOLVE_OUTPUT=$(npx prisma migrate resolve --applied "$MIGRATION_NAME" 2>&1)
                RESOLVE_EXIT_CODE=$?

                if [ $RESOLVE_EXIT_CODE -eq 0 ]; then
                    echo "$(date -Iseconds) [INFO] [DOCKER] ✅ Migration $MIGRATION_NAME marked as applied"

                    # 再次尝试应用剩余的迁移
                    echo "$(date -Iseconds) [INFO] [DOCKER] � Applying remaining migrations..."
                    MIGRATION_OUTPUT=$(npx prisma migrate deploy 2>&1)
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

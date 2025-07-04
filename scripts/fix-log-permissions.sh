#!/bin/sh

# 修复日志目录权限脚本
# 用于在容器启动时确保日志目录有正确的权限

LOG_DIR="${LOG_DIR:-/app/logs}"

echo "$(date -Iseconds) [INFO] [PERMISSIONS] 🔧 Fixing log directory permissions..."

# 检查日志目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "$(date -Iseconds) [INFO] [PERMISSIONS] 📁 Creating log directory: $LOG_DIR"
    mkdir -p "$LOG_DIR" || {
        echo "$(date -Iseconds) [ERROR] [PERMISSIONS] ❌ Failed to create log directory"
        exit 1
    }
fi

# 获取当前用户信息
CURRENT_USER=$(id -u)
CURRENT_GROUP=$(id -g)

echo "$(date -Iseconds) [INFO] [PERMISSIONS] 👤 Current user: $CURRENT_USER:$CURRENT_GROUP"

# 检查目录权限
if [ -w "$LOG_DIR" ]; then
    echo "$(date -Iseconds) [INFO] [PERMISSIONS] ✅ Log directory is writable"
else
    echo "$(date -Iseconds) [WARN] [PERMISSIONS] ⚠️ Log directory is not writable, attempting to fix..."
    
    # 尝试修复权限
    chmod 755 "$LOG_DIR" 2>/dev/null || {
        echo "$(date -Iseconds) [WARN] [PERMISSIONS] ⚠️ Cannot change directory permissions, file logging will be disabled"
        exit 0
    }
    
    # 再次检查
    if [ -w "$LOG_DIR" ]; then
        echo "$(date -Iseconds) [INFO] [PERMISSIONS] ✅ Log directory permissions fixed"
    else
        echo "$(date -Iseconds) [WARN] [PERMISSIONS] ⚠️ Log directory still not writable, file logging will be disabled"
        exit 0
    fi
fi

# 检查是否可以创建文件
TEST_FILE="$LOG_DIR/.test-write"
if touch "$TEST_FILE" 2>/dev/null; then
    rm -f "$TEST_FILE"
    echo "$(date -Iseconds) [INFO] [PERMISSIONS] ✅ Log directory write test successful"
else
    echo "$(date -Iseconds) [WARN] [PERMISSIONS] ⚠️ Cannot write to log directory, file logging will be disabled"
    exit 0
fi

echo "$(date -Iseconds) [INFO] [PERMISSIONS] 🎯 Log directory permissions are correct"

#!/bin/bash

# 日志轮转脚本
# 用于定期清理和压缩应用日志文件

LOG_DIR="${LOG_DIR:-/app/logs}"
LOG_FILE="$LOG_DIR/app.log"
MAX_SIZE="${LOG_MAX_SIZE:-100M}"
MAX_FILES="${LOG_MAX_FILES:-10}"

# 检查日志目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "$(date -Iseconds) [WARN] [LOG_ROTATE] Log directory $LOG_DIR does not exist"
    exit 1
fi

# 检查日志文件是否存在
if [ ! -f "$LOG_FILE" ]; then
    echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Log file $LOG_FILE does not exist, nothing to rotate"
    exit 0
fi

# 获取文件大小（字节）
FILE_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo "0")

# 转换最大大小为字节
case "$MAX_SIZE" in
    *K|*k) MAX_BYTES=$((${MAX_SIZE%[Kk]} * 1024)) ;;
    *M|*m) MAX_BYTES=$((${MAX_SIZE%[Mm]} * 1024 * 1024)) ;;
    *G|*g) MAX_BYTES=$((${MAX_SIZE%[Gg]} * 1024 * 1024 * 1024)) ;;
    *) MAX_BYTES="$MAX_SIZE" ;;
esac

echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Current log size: $FILE_SIZE bytes, max: $MAX_BYTES bytes"

# 检查是否需要轮转
if [ "$FILE_SIZE" -lt "$MAX_BYTES" ]; then
    echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Log file size is within limits, no rotation needed"
    exit 0
fi

echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Starting log rotation..."

# 轮转现有的日志文件
for i in $(seq $((MAX_FILES - 1)) -1 1); do
    OLD_FILE="$LOG_DIR/app.log.$i.gz"
    NEW_FILE="$LOG_DIR/app.log.$((i + 1)).gz"
    
    if [ -f "$OLD_FILE" ]; then
        mv "$OLD_FILE" "$NEW_FILE"
        echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Moved $OLD_FILE to $NEW_FILE"
    fi
done

# 压缩当前日志文件
if [ -f "$LOG_FILE" ]; then
    gzip -c "$LOG_FILE" > "$LOG_DIR/app.log.1.gz"
    echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Compressed current log to app.log.1.gz"
    
    # 清空当前日志文件（保持文件句柄）
    > "$LOG_FILE"
    echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Truncated current log file"
fi

# 删除超出保留数量的旧日志
for i in $(seq $((MAX_FILES + 1)) 20); do
    OLD_FILE="$LOG_DIR/app.log.$i.gz"
    if [ -f "$OLD_FILE" ]; then
        rm -f "$OLD_FILE"
        echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Removed old log file $OLD_FILE"
    fi
done

echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Log rotation completed"

# 显示当前日志文件状态
echo "$(date -Iseconds) [INFO] [LOG_ROTATE] Current log files:"
ls -lh "$LOG_DIR"/app.log* 2>/dev/null || echo "No log files found"

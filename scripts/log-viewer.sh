#!/bin/bash

# 日志查看脚本
# 提供便捷的日志查看和搜索功能

LOG_DIR="${LOG_DIR:-./logs}"
LOG_FILE="$LOG_DIR/app.log"

# 显示帮助信息
show_help() {
    cat << EOF
日志查看工具

用法: $0 [选项]

选项:
    -h, --help          显示此帮助信息
    -f, --follow        实时跟踪日志（类似 tail -f）
    -n, --lines NUM     显示最后 NUM 行（默认100）
    -s, --search TERM   搜索包含指定关键词的日志行
    -l, --level LEVEL   过滤指定级别的日志 (DEBUG|INFO|WARN|ERROR)
    -m, --module MODULE 过滤指定模块的日志
    -t, --time RANGE    显示指定时间范围的日志
                        格式: "2024-01-01 00:00:00,2024-01-01 23:59:59"
    --list              列出所有可用的日志文件
    --size              显示日志文件大小信息

示例:
    $0 -n 50                    # 显示最后50行日志
    $0 -f                       # 实时跟踪日志
    $0 -s "ERROR"               # 搜索包含ERROR的日志
    $0 -l ERROR                 # 只显示ERROR级别的日志
    $0 -m "TRPC"                # 只显示TRPC模块的日志
    $0 --list                   # 列出所有日志文件
EOF
}

# 列出日志文件
list_logs() {
    echo "可用的日志文件:"
    if [ -d "$LOG_DIR" ]; then
        ls -lh "$LOG_DIR"/app.log* 2>/dev/null | while read -r line; do
            echo "  $line"
        done
    else
        echo "  日志目录 $LOG_DIR 不存在"
    fi
}

# 显示日志文件大小
show_size() {
    echo "日志文件大小信息:"
    if [ -d "$LOG_DIR" ]; then
        du -h "$LOG_DIR"/app.log* 2>/dev/null | while read -r size file; do
            echo "  $size  $file"
        done
        echo ""
        echo "总大小: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)"
    else
        echo "  日志目录 $LOG_DIR 不存在"
    fi
}

# 构建日志查看命令
build_command() {
    local cmd="cat"
    local files="$LOG_FILE"
    
    # 如果需要包含压缩文件
    if [ "$INCLUDE_ARCHIVED" = "true" ]; then
        files="$LOG_DIR/app.log*"
        cmd="zcat -f"
    fi
    
    # 基础命令
    local pipeline="$cmd $files 2>/dev/null"
    
    # 添加过滤条件
    if [ -n "$SEARCH_TERM" ]; then
        pipeline="$pipeline | grep -i '$SEARCH_TERM'"
    fi
    
    if [ -n "$LOG_LEVEL" ]; then
        pipeline="$pipeline | grep '\"level\":\"$LOG_LEVEL\"'"
    fi
    
    if [ -n "$MODULE_NAME" ]; then
        pipeline="$pipeline | grep '\"module\":\"$MODULE_NAME\"'"
    fi
    
    if [ -n "$TIME_RANGE" ]; then
        local start_time=$(echo "$TIME_RANGE" | cut -d',' -f1)
        local end_time=$(echo "$TIME_RANGE" | cut -d',' -f2)
        pipeline="$pipeline | awk -v start='$start_time' -v end='$end_time' '\$0 >= start && \$0 <= end'"
    fi
    
    # 添加行数限制
    if [ -n "$NUM_LINES" ] && [ "$FOLLOW_MODE" != "true" ]; then
        pipeline="$pipeline | tail -n $NUM_LINES"
    fi
    
    echo "$pipeline"
}

# 解析命令行参数
FOLLOW_MODE="false"
NUM_LINES="100"
SEARCH_TERM=""
LOG_LEVEL=""
MODULE_NAME=""
TIME_RANGE=""
INCLUDE_ARCHIVED="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--follow)
            FOLLOW_MODE="true"
            shift
            ;;
        -n|--lines)
            NUM_LINES="$2"
            shift 2
            ;;
        -s|--search)
            SEARCH_TERM="$2"
            shift 2
            ;;
        -l|--level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -m|--module)
            MODULE_NAME="$2"
            shift 2
            ;;
        -t|--time)
            TIME_RANGE="$2"
            shift 2
            ;;
        --list)
            list_logs
            exit 0
            ;;
        --size)
            show_size
            exit 0
            ;;
        --archived)
            INCLUDE_ARCHIVED="true"
            shift
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查日志文件是否存在
if [ ! -f "$LOG_FILE" ]; then
    echo "错误: 日志文件 $LOG_FILE 不存在"
    echo "提示: 使用 --list 查看可用的日志文件"
    exit 1
fi

# 执行日志查看
if [ "$FOLLOW_MODE" = "true" ]; then
    echo "实时跟踪日志文件: $LOG_FILE"
    echo "按 Ctrl+C 退出"
    echo "----------------------------------------"
    tail -f "$LOG_FILE"
else
    echo "显示日志文件: $LOG_FILE"
    if [ -n "$SEARCH_TERM" ]; then
        echo "搜索关键词: $SEARCH_TERM"
    fi
    if [ -n "$LOG_LEVEL" ]; then
        echo "日志级别: $LOG_LEVEL"
    fi
    if [ -n "$MODULE_NAME" ]; then
        echo "模块: $MODULE_NAME"
    fi
    echo "----------------------------------------"
    
    # 构建并执行命令
    cmd=$(build_command)
    eval "$cmd"
fi

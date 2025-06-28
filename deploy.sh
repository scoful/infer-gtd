#!/bin/bash

# GTD 应用部署脚本
# 用于从阿里云拉取镜像并部署应用

set -e

# 配置变量
REGISTRY="registry.cn-guangzhou.aliyuncs.com"
NAMESPACE="scoful"
IMAGE_NAME="infer-gtd"
DEFAULT_TAG="latest"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必需的工具
check_requirements() {
    log_info "检查部署环境..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或不在 PATH 中"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装或不在 PATH 中"
        exit 1
    fi
    
    log_info "环境检查通过"
}

# 加载环境变量
load_env_vars() {
    if [ -f ".env" ]; then
        log_info "加载 .env 文件中的环境变量..."
        # 导出 .env 文件中的变量（忽略注释和空行）
        export $(grep -v '^#' .env | grep -v '^$' | xargs)
    fi
}

# 登录阿里云镜像仓库
login_registry() {
    log_info "登录阿里云镜像仓库..."

    # 先尝试加载 .env 文件
    load_env_vars

    if [ -z "$ALIYUN_USERNAME" ] || [ -z "$ALIYUN_PASSWORD" ]; then
        log_error "请设置环境变量 ALIYUN_USERNAME 和 ALIYUN_PASSWORD"
        log_error "可以在 .env 文件中设置，或者通过以下方式运行："
        log_error "ALIYUN_USERNAME=your-username ALIYUN_PASSWORD=your-password ./deploy.sh"
        exit 1
    fi

    echo "$ALIYUN_PASSWORD" | docker login --username "$ALIYUN_USERNAME" --password-stdin "$REGISTRY"
    log_info "登录成功"
}

# 拉取最新镜像
pull_image() {
    local tag=${1:-$DEFAULT_TAG}
    local image_url="$REGISTRY/$NAMESPACE/$IMAGE_NAME:$tag"
    
    log_info "拉取镜像: $image_url"
    docker pull "$image_url"
    
    # 设置环境变量供 docker-compose 使用
    export DOCKER_IMAGE="$image_url"
    log_info "镜像拉取完成"
}

# 停止现有服务
stop_services() {
    log_info "停止现有服务..."
    docker-compose -f docker-compose.yml down || true
    log_info "服务已停止"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    # 检查环境文件
    if [ ! -f ".env" ]; then
        log_error ".env 文件不存在，请创建并配置环境变量"
        exit 1
    fi

    # 启动服务
    docker-compose -f docker-compose.yml up -d

    log_info "等待容器启动..."
    sleep 5

    # 检查容器状态
    if docker-compose -f docker-compose.yml ps | grep -q "Up"; then
        log_info "容器启动成功"
    else
        log_error "容器启动失败"
        docker-compose -f docker-compose.yml logs
        exit 1
    fi
}

# 等待应用启动完成
wait_for_startup() {
    log_info "等待应用启动完成..."

    local max_attempts=60  # 增加到 60 次，总共 5 分钟
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        # 使用基础健康检查端点，不依赖数据库
        local response=$(curl -s -w "%{http_code}" http://localhost:3001/api/health/basic 2>/dev/null || echo "000")
        local http_code="${response: -3}"

        if [ "$http_code" = "200" ]; then
            log_info "应用启动完成"
            return 0
        elif [ "$http_code" = "202" ]; then
            log_info "应用启动中... ($attempt/$max_attempts)"
        else
            log_warn "应用启动检查失败，HTTP状态码: $http_code ($attempt/$max_attempts)"
        fi

        sleep 5
        ((attempt++))
    done

    log_error "应用启动超时，请检查容器日志"
    docker-compose -f docker-compose.yml logs --tail=50
    return 1
}

# 健康检查
health_check() {
    log_info "执行完整健康检查..."

    local max_attempts=10  # 减少到 10 次，因为应用已经启动完成
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/api/health &> /dev/null; then
            log_info "健康检查通过"
            return 0
        fi

        log_warn "健康检查失败，重试 $attempt/$max_attempts"
        sleep 3
        ((attempt++))
    done

    log_error "健康检查失败，服务可能未正常启动"
    return 1
}

# 清理旧镜像
cleanup() {
    log_info "清理未使用的镜像..."
    docker image prune -f
    log_info "清理完成"
}

# 显示帮助信息
show_help() {
    echo "GTD 应用部署脚本"
    echo ""
    echo "用法: $0 [选项] [镜像标签]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -c, --cleanup  部署后清理未使用的镜像"
    echo "  --no-health    跳过健康检查"
    echo ""
    echo "环境变量:"
    echo "  ALIYUN_USERNAME  阿里云镜像仓库用户名（可在 .env 文件中设置）"
    echo "  ALIYUN_PASSWORD  阿里云镜像仓库密码（可在 .env 文件中设置）"
    echo ""
    echo "示例:"
    echo "  $0                    # 部署 latest 标签（从 .env 读取凭据）"
    echo "  $0 v1.0.0            # 部署指定标签"
    echo "  $0 -c latest         # 部署并清理"
    echo "  ALIYUN_USERNAME=user ALIYUN_PASSWORD=pass $0  # 临时设置凭据"
    echo ""
    echo "系统要求:"
    echo "  - Linux/macOS 系统"
    echo "  - Docker 和 Docker Compose"
    echo "  - curl 命令"
}

# 主函数
main() {
    local tag="$DEFAULT_TAG"
    local cleanup_flag=false
    local health_check_flag=true
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--cleanup)
                cleanup_flag=true
                shift
                ;;
            --no-health)
                health_check_flag=false
                shift
                ;;
            -*)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                tag="$1"
                shift
                ;;
        esac
    done
    
    log_info "开始部署 GTD 应用..."
    log_info "镜像标签: $tag"
    
    # 执行部署步骤
    check_requirements
    login_registry
    pull_image "$tag"
    stop_services
    start_services

    # 等待应用启动完成
    wait_for_startup

    if [ "$health_check_flag" = true ]; then
        health_check
    fi
    
    if [ "$cleanup_flag" = true ]; then
        cleanup
    fi
    
    log_info "部署完成！"
    log_info "应用访问地址: http://localhost:3001"
}

# 执行主函数
main "$@"

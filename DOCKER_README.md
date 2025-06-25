# Docker 部署指南

本项目支持使用 Docker 进行部署，集成了 GitHub Actions CI/CD 流程，自动构建并推送镜像到阿里云容器镜像服务。

## 文件说明

- `Dockerfile` - 生产环境多阶段构建
- `docker-compose.yml` - 生产环境编排（从阿里云拉取镜像）
- `.dockerignore` - Docker 构建忽略文件
- `.github/workflows/main.yml` - GitHub Actions CI/CD 配置
- `deploy.sh` - 自动化部署脚本

## CI/CD 流程

### GitHub Actions 自动化

项目配置了 GitHub Actions，当代码推送到 `main` 分支时自动执行：

1. **构建 Docker 镜像** - 使用多阶段构建优化镜像大小
2. **推送到阿里云** - 自动推送到阿里云容器镜像服务
3. **多标签支持** - 支持 latest、分支名、commit hash 等多种标签

### 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

```
ALIYUN_DOCKER_HUB_REGISTRY=registry.cn-hangzhou.aliyuncs.com/your-namespace
ALIYUN_DOCKER_HUB_USERNAME=your-aliyun-username
ALIYUN_DOCKER_HUB_PASSWORD=your-aliyun-password
```

## 环境变量配置

### 必需的环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
# 数据库连接
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth 配置
AUTH_SECRET="your-auth-secret-here"
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# 应用 URL（生产环境）
NEXTAUTH_URL="https://your-domain.com"

# Docker 镜像地址
DOCKER_IMAGE="registry.cn-hangzhou.aliyuncs.com/your-namespace/infer-gtd:latest"
```

## 生产环境部署

### 方式一：使用自动化部署脚本（推荐）

```bash
# 部署最新版本
./deploy.sh

# 部署指定版本
./deploy.sh v1.0.0

# 部署并清理旧镜像
./deploy.sh -c latest
```

### 方式二：手动部署

```bash
# 1. 设置环境变量
export DOCKER_IMAGE="registry.cn-hangzhou.aliyuncs.com/your-namespace/infer-gtd:latest"

# 2. 登录阿里云镜像仓库
echo "$ALIYUN_PASSWORD" | docker login --username "$ALIYUN_USERNAME" --password-stdin registry.cn-hangzhou.aliyuncs.com

# 3. 拉取镜像
docker pull $DOCKER_IMAGE

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f app
```

### 数据库迁移

如果是首次部署，需要运行数据库迁移：

```bash
# 进入容器执行迁移
docker-compose exec app pnpm prisma migrate deploy

# 或者推送数据库结构
docker-compose exec app pnpm prisma db push
```

### 停止服务

```bash
docker-compose down
```

## 常用命令

### 容器管理

```bash
# 查看运行状态
docker-compose ps

# 重启服务
docker-compose restart app

# 查看资源使用
docker stats
```

### 数据库操作

```bash
# 生成 Prisma 客户端
docker-compose exec app pnpm prisma generate

# 查看数据库状态
docker-compose exec app pnpm prisma db status

# 查看数据库状态
docker-compose exec app pnpm prisma db status
```

### 日志和调试

```bash
# 查看应用日志
docker-compose logs app

# 进入容器 shell
docker-compose exec app sh

# 健康检查
curl http://localhost:3000/api/health
```

## 性能优化

### 1. 镜像优化

- 使用多阶段构建减少镜像大小
- 利用 Docker 层缓存
- 优化 .dockerignore 文件

### 2. 运行时优化

- 设置合适的内存限制
- 配置健康检查
- 使用非 root 用户运行

### 3. 监控配置

资源限制已在 docker-compose.yml 中配置：
- 内存限制：1GB（预留 512MB）
- CPU 限制：1.0 核心（预留 0.5 核心）
- 日志轮转：最大 50MB，保留 5 个文件

## 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本兼容性
   - 确认 pnpm-lock.yaml 文件存在
   - 验证环境变量配置

2. **数据库连接失败**
   - 检查 DATABASE_URL 格式
   - 确认数据库服务可访问
   - 验证网络连接

3. **应用启动失败**
   - 查看容器日志
   - 检查端口占用
   - 验证环境变量

### 调试步骤

```bash
# 1. 检查容器状态
docker-compose ps

# 2. 查看详细日志
docker-compose logs --tail=100 app

# 3. 进入容器调试
docker-compose exec app sh

# 4. 测试健康检查
curl -f http://localhost:3000/api/health
```

## 安全建议

1. 使用非 root 用户运行容器
2. 定期更新基础镜像
3. 不在镜像中包含敏感信息
4. 使用 secrets 管理敏感配置
5. 启用容器安全扫描

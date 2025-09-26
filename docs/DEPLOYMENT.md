# GTD 应用生产环境部署指南

## 🚀 快速部署

### 1. 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

```
ALIYUN_DOCKER_HUB_REGISTRY=registry.cn-guangzhou.aliyuncs.com/scoful/infer-gtd
ALIYUN_DOCKER_HUB_USERNAME=your-aliyun-username
ALIYUN_DOCKER_HUB_PASSWORD=your-aliyun-password
```

**注意**：`ALIYUN_DOCKER_HUB_REGISTRY` 必须包含完整的镜像路径（registry + namespace + repository）！

### 2. 服务器环境准备

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 克隆项目（仅需要部署文件）
git clone https://github.com/your-username/infer-gtd.git
cd infer-gtd

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际配置（包括阿里云凭据）
```

**注意**: 本项目采用无状态部署，所有数据存储在外部PostgreSQL数据库中。

### 3. 一键部署

```bash
# 设置部署脚本权限
chmod +x deploy.sh

# 部署最新版本
./deploy.sh

# 部署指定版本
./deploy.sh v1.0.0
```

## 📋 必需的环境变量

```bash
# 数据库连接
DATABASE_URL="postgresql://username:password@host:port/database"

# 认证配置
AUTH_SECRET="your-super-secret-auth-key"
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# 应用配置
NEXTAUTH_URL="https://your-domain.com"
DOCKER_IMAGE="registry.cn-guangzhou.aliyuncs.com/scoful/infer-gtd:latest"

# 部署脚本使用
ALIYUN_USERNAME="your-aliyun-username"
ALIYUN_PASSWORD="your-aliyun-password"
```

## 🔄 CI/CD 流程

1. **推送代码** → GitHub Actions 自动构建
2. **镜像推送** → 自动推送到阿里云镜像仓库
3. **服务器部署** → 运行 `./deploy.sh` 拉取最新镜像

## 📊 监控和维护

### 健康检查
```bash
curl http://localhost:3001/api/health
```

### 查看日志
```bash
docker-compose logs -f app
```

### 重启服务
```bash
docker-compose restart app
```

### 数据库迁移
```bash
docker-compose exec app pnpm prisma migrate deploy
```

## 🛡️ 安全配置

1. 使用强密码和密钥
2. 定期更新镜像
3. 配置防火墙规则
4. 启用 HTTPS
5. 定期备份数据库

## 📈 性能优化

- 内存限制：1GB
- CPU 限制：1.0 核心
- 日志轮转：50MB × 5 文件
- 健康检查：30秒间隔

## 🔧 故障排除

### 常见问题
1. **镜像拉取失败** → 检查阿里云凭据
2. **应用启动失败** → 检查环境变量配置
3. **数据库连接失败** → 验证 DATABASE_URL

### 调试命令
```bash
# 检查容器状态
docker-compose ps

# 查看详细日志
docker-compose logs --tail=100 app

# 进入容器调试
docker-compose exec app sh
```

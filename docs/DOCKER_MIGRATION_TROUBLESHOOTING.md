# Docker 数据库迁移问题排查指南

## 问题描述

当使用 Docker 部署应用时，如果遇到数据库迁移相关错误，可以参考以下解决方案。

## 常见问题

### P3005 错误 - 数据库不为空

如果遇到以下错误：
```
Error: P3005
The database schema is not empty.
```

**解决方案：重置数据库**
```bash
# 进入容器
docker exec -it gtd-app sh

# 重置数据库（会删除所有数据）
npx prisma migrate reset --force

# 退出容器并重启
exit
docker restart gtd-app
```

### 迁移失败

如果迁移部署失败：

```bash
# 检查迁移状态
docker exec gtd-app npx prisma migrate status

# 手动部署迁移
docker exec gtd-app npx prisma migrate deploy
```

## 验证部署

```bash
# 检查容器状态
docker ps | grep gtd-app

# 查看启动日志
docker logs gtd-app

# 应该看到类似输出：
# 🚀 Starting GTD Application...
# 📡 Checking database connection...
# 🔄 Running database migrations...
# ⚙️ Generating Prisma client...
# ✅ Database setup completed successfully
# 🎯 Starting Next.js application...

# 测试应用
curl http://localhost:3001/api/health
```

## 常见错误处理

### 数据库连接失败
```bash
# 检查数据库连接
docker exec gtd-app npx prisma db push --accept-data-loss --skip-generate

# 检查环境变量
docker exec gtd-app env | grep DATABASE_URL
```

### 容器启动失败
```bash
# 查看详细日志
docker logs gtd-app --details

# 重新构建镜像
docker-compose build --no-cache
```

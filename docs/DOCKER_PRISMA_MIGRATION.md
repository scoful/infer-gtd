# Docker环境中的Prisma数据库迁移指南

## 📋 概述

本文档详细说明如何在Docker环境中正确处理Prisma数据库迁移，确保数据库结构与代码保持同步。

## 🔧 迁移策略

### 自动迁移（推荐）

项目已配置自动迁移机制，容器启动时会自动执行：

1. **检查数据库连接**
2. **执行待处理的迁移**
3. **生成Prisma客户端**
4. **启动应用**

### 手动迁移

如果需要手动控制迁移过程：

```bash
# 进入运行中的容器
docker exec -it gtd-app sh

# 执行迁移
npx prisma migrate deploy

# 生成客户端
npx prisma generate

# 重启应用（如果需要）
exit
docker restart gtd-app
```

## 🚀 部署流程

### 生产环境部署

```bash
# 1. 构建新镜像
docker build -t your-registry/infer-gtd:latest .

# 2. 推送到镜像仓库
docker push your-registry/infer-gtd:latest

# 3. 更新生产环境
docker-compose pull
docker-compose up -d

# 4. 检查迁移状态
docker logs gtd-app
```

### 开发环境部署

```bash
# 1. 使用开发配置启动
docker-compose -f docker-compose.dev.yml up --build

# 2. 查看启动日志
docker-compose -f docker-compose.dev.yml logs -f app
```

## 📝 迁移文件管理

### 创建新迁移

```bash
# 在本地开发环境
npx prisma migrate dev --name your-migration-name

# 提交迁移文件到版本控制
git add prisma/migrations/
git commit -m "Add: your-migration-name migration"
```

### 迁移文件结构

```
prisma/
├── migrations/
│   ├── 20250627035213_add_note_summary/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

## 🔍 故障排除

### 常见问题

#### 1. 迁移失败

```bash
# 查看详细错误日志
docker logs gtd-app

# 重置迁移（谨慎使用）
docker exec -it gtd-app npx prisma migrate reset --force
```

#### 2. 数据库连接失败

```bash
# 检查环境变量
docker exec -it gtd-app env | grep DATABASE_URL

# 测试数据库连接
docker exec -it gtd-app npx prisma db push --accept-data-loss
```

#### 3. Prisma客户端版本不匹配

```bash
# 重新生成客户端
docker exec -it gtd-app npx prisma generate

# 重启容器
docker restart gtd-app
```

### 数据库状态检查

```bash
# 查看迁移状态
docker exec -it gtd-app npx prisma migrate status

# 查看数据库结构
docker exec -it gtd-app npx prisma db pull
```

## ⚠️ 注意事项

### 生产环境

1. **备份数据库** - 执行迁移前务必备份
2. **测试迁移** - 在测试环境验证迁移
3. **监控日志** - 关注迁移执行日志
4. **回滚计划** - 准备回滚方案

### 开发环境

1. **同步迁移** - 团队成员及时拉取最新迁移
2. **清理数据** - 开发环境可以使用 `migrate reset`
3. **测试数据** - 使用种子数据进行测试

## 📚 相关命令参考

### Docker命令

```bash
# 构建镜像
docker build -t infer-gtd .

# 运行容器
docker run -d --name gtd-app -p 3001:3000 --env-file .env infer-gtd

# 查看日志
docker logs -f gtd-app

# 进入容器
docker exec -it gtd-app sh

# 停止和删除容器
docker stop gtd-app && docker rm gtd-app
```

### Prisma命令

```bash
# 开发环境迁移
npx prisma migrate dev

# 生产环境迁移
npx prisma migrate deploy

# 重置数据库
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status

# 生成客户端
npx prisma generate
```

## 🎯 最佳实践

1. **版本控制** - 所有迁移文件都要提交到Git
2. **命名规范** - 使用描述性的迁移名称
3. **测试优先** - 在测试环境验证迁移
4. **监控部署** - 关注生产环境迁移日志
5. **文档更新** - 重要迁移要更新文档

---

如有问题，请查看项目文档或联系开发团队。

# 环境变量详细分析

## 📊 环境变量分类

### 🔴 **必需配置 - 应用运行时使用**

#### 1. `DATABASE_URL`
- **用途**: 应用代码连接PostgreSQL数据库
- **验证**: `src/env.js` - `z.string().url()`
- **使用场景**: 运行时
- **示例**: `postgresql://user:pass@host:5432/db`

#### 2. `AUTH_SECRET`
- **用途**: NextAuth.js会话加密密钥
- **验证**: `src/env.js` - 生产环境必需，开发环境可选
- **使用场景**: 运行时
- **生成**: `npx auth secret`

#### 3. `AUTH_GITHUB_ID`
- **用途**: GitHub OAuth应用ID
- **验证**: `src/env.js` - `z.string()`
- **使用场景**: 运行时
- **获取**: GitHub Developer Settings

#### 4. `AUTH_GITHUB_SECRET`
- **用途**: GitHub OAuth应用密钥
- **验证**: `src/env.js` - `z.string()`
- **使用场景**: 运行时
- **获取**: GitHub Developer Settings

### 🟡 **重要配置 - 生产环境建议设置**

#### 5. `NEXTAUTH_URL`
- **用途**: NextAuth.js回调URL基础地址
- **验证**: `src/env.js` - `z.string().url().optional()`
- **使用场景**: 运行时
- **说明**: 开发环境可自动推断，生产环境建议明确设置

### 🟢 **可选配置 - Docker部署使用**

#### 6. `APP_PORT`
- **用途**: Docker容器端口映射
- **验证**: 无（docker-compose使用）
- **使用场景**: Docker部署
- **默认值**: 3001

#### 7. `DOCKER_IMAGE`
- **用途**: Docker镜像地址
- **验证**: 无（docker-compose使用）
- **使用场景**: Docker部署
- **示例**: `registry.cn-guangzhou.aliyuncs.com/scoful/infer-gtd:latest`

#### 8. `ALIYUN_USERNAME`
- **用途**: 阿里云镜像仓库用户名
- **验证**: 无（deploy.sh脚本使用）
- **使用场景**: 部署脚本
- **说明**: 用于自动登录阿里云镜像仓库

#### 9. `ALIYUN_PASSWORD`
- **用途**: 阿里云镜像仓库密码
- **验证**: 无（deploy.sh脚本使用）
- **使用场景**: 部署脚本
- **说明**: 用于自动登录阿里云镜像仓库

### ⚙️ **系统配置 - 自动设置**

#### 10. `NODE_ENV`
- **用途**: Node.js运行环境
- **验证**: `src/env.js` - `z.enum(["development", "test", "production"])`
- **使用场景**: 运行时
- **设置**: Dockerfile中自动设置为production

#### 11. `SKIP_ENV_VALIDATION`
- **用途**: 跳过环境变量验证
- **验证**: `src/env.js` - `!!process.env.SKIP_ENV_VALIDATION`
- **使用场景**: Docker构建时
- **设置**: Dockerfile中自动设置为1

#### 12. `NEXT_TELEMETRY_DISABLED`
- **用途**: 禁用Next.js遥测
- **验证**: 无（Next.js内部使用）
- **使用场景**: 构建和运行时
- **设置**: Dockerfile中自动设置为1

## 🗂️ **使用场景分类**

### 应用代码使用（需要在env.js中验证）
- ✅ `DATABASE_URL`
- ✅ `AUTH_SECRET`
- ✅ `AUTH_GITHUB_ID`
- ✅ `AUTH_GITHUB_SECRET`
- ✅ `NEXTAUTH_URL`
- ✅ `NODE_ENV`

### Docker构建时使用
- `SKIP_ENV_VALIDATION` (Dockerfile中设置)
- `NODE_ENV` (Dockerfile中设置)
- `NEXT_TELEMETRY_DISABLED` (Dockerfile中设置)

### Docker运行时使用
- `APP_PORT` (docker-compose.yml使用)
- `DOCKER_IMAGE` (docker-compose.yml使用)

### 部署脚本使用
- `ALIYUN_USERNAME` (deploy.sh使用)
- `ALIYUN_PASSWORD` (deploy.sh使用)

## 🔧 **已移除的冗余配置**

### 从.env.example中移除的变量：
1. **注释说明**: 简化了冗长的注释
2. **GitHub Actions配置**: 移到文档中说明
3. **系统变量**: NODE_ENV、NEXT_TELEMETRY_DISABLED等改为注释说明

### 原因：
- **减少混淆**: 用户只需关注必要配置
- **自动设置**: 系统变量由Dockerfile自动设置
- **分离关注点**: 部署相关配置与应用配置分离

## 📋 **配置优先级**

### 最小配置（开发环境）
```bash
DATABASE_URL="postgresql://..."
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."
```

### 生产环境配置
```bash
# 必需
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."

# 建议
NEXTAUTH_URL="https://your-domain.com"
```

### Docker部署配置
```bash
# 生产环境配置 +
APP_PORT=3001
DOCKER_IMAGE="registry.cn-guangzhou.aliyuncs.com/scoful/infer-gtd:latest"
ALIYUN_USERNAME="..."
ALIYUN_PASSWORD="..."
```

## ⚠️ **注意事项**

1. **敏感信息**: AUTH_SECRET、AUTH_GITHUB_SECRET、ALIYUN_PASSWORD等不要提交到版本控制
2. **环境区分**: 开发和生产环境使用不同的配置文件
3. **验证机制**: 应用启动时会验证必需的环境变量
4. **Docker优化**: 构建时的环境变量已在Dockerfile中优化设置

# 日志配置指南

## 概述

本项目使用 [Pino](https://getpino.io/) 作为主要的日志库，提供高性能、结构化的日志记录功能。日志系统支持开发和生产环境的不同配置，并与 Docker 容器完美集成。

## 日志格式

### 生产环境（JSON格式）
```json
{
  "level": "INFO",
  "time": "2025-06-28T10:30:45.123Z",
  "module": "API",
  "requestId": "req_1719574245123_abc123def",
  "msg": "GET /api/tasks - 200 (45ms)",
  "method": "GET",
  "path": "/api/tasks",
  "statusCode": 200,
  "duration": 45,
  "userId": "user_123",
  "type": "api"
}
```

### 开发环境（美化格式）
```
[10:30:45.123] INFO (API): GET /api/tasks - 200 (45ms)
    requestId: "req_1719574245123_abc123def"
    method: "GET"
    path: "/api/tasks"
    statusCode: 200
    duration: 45
    userId: "user_123"
    type: "api"
```

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 日志级别：debug, info, warn, error
LOG_LEVEL=info

# 日志格式：json, pretty
LOG_FORMAT=json
```

### 日志级别说明

- **debug**: 详细的调试信息（仅开发环境推荐）
- **info**: 一般信息，包括API调用、数据库操作等
- **warn**: 警告信息，不影响正常运行但需要注意
- **error**: 错误信息，需要立即处理

## 模块化日志

项目按功能模块划分了不同的日志记录器：

```typescript
import { loggers } from "@/utils/logger";

// 应用级别日志
loggers.app.info("应用启动完成");

// API 调用日志
loggers.api.info("处理用户请求");

// 数据库操作日志
loggers.db.info("执行数据库查询");

// 认证相关日志
loggers.auth.info("用户登录成功");

// Docker 容器日志
loggers.docker.info("容器启动完成");

// 健康检查日志
loggers.health.info("健康检查通过");
```

## 专用日志函数

### 错误日志
```typescript
import { logError } from "@/utils/logger";

try {
  // 业务逻辑
} catch (error) {
  logError(loggers.api, error, {
    userId: "user_123",
    operation: "createTask"
  });
}
```

### 性能监控
```typescript
import { logPerformance } from "@/utils/logger";

const start = Date.now();
// 执行操作
const duration = Date.now() - start;

logPerformance(loggers.api, "createTask", duration, {
  userId: "user_123",
  taskId: "task_456"
});
```

### 用户操作日志
```typescript
import { logUserAction } from "@/utils/logger";

logUserAction("task_created", userId, {
  taskId: "task_123",
  projectId: "project_456"
});
```

### 数据库操作日志
```typescript
import { logDatabaseOperation } from "@/utils/logger";

logDatabaseOperation("INSERT", "tasks", 25, {
  userId: "user_123",
  recordId: "task_456"
});
```

## tRPC 集成

tRPC 调用会自动记录日志，包含以下信息：
- 调用的 procedure 名称
- 操作类型（query/mutation）
- 执行时间
- 成功/失败状态
- 用户ID（如果已认证）
- 错误信息（如果失败）

## Docker 容器日志

### 查看实时日志
```bash
# 查看应用日志
docker-compose logs -f app

# 查看最近100行日志
docker-compose logs --tail=100 app

# 查看特定时间段的日志
docker-compose logs --since="2025-06-28T10:00:00" app
```

### 日志轮转配置

Docker Compose 已配置日志轮转：
- 最大文件大小：50MB
- 保留文件数：5个
- 总日志大小限制：250MB

## 健康检查日志

健康检查 API 会记录以下状态：
- `healthy`: 应用正常运行
- `unhealthy`: 应用异常
- `starting`: 应用启动中

## 最佳实践

### 1. 日志级别使用
- 生产环境使用 `info` 级别
- 开发环境可使用 `debug` 级别
- 错误处理必须使用 `error` 级别

### 2. 结构化信息
```typescript
// ✅ 好的做法
logger.info({
  userId: "user_123",
  operation: "createTask",
  duration: 45,
  success: true
}, "任务创建成功");

// ❌ 避免的做法
logger.info("用户 user_123 创建任务成功，耗时 45ms");
```

### 3. 敏感信息处理
```typescript
// ✅ 安全的做法
logger.info({
  userId: user.id,
  email: user.email.replace(/(.{2}).*(@.*)/, "$1***$2")
}, "用户登录");

// ❌ 避免记录敏感信息
logger.info({ password: user.password }, "用户信息");
```

### 4. 请求追踪
每个请求都会自动分配一个 `requestId`，用于追踪完整的请求生命周期。

## 监控和告警

### 日志查询示例

在生产环境中，可以使用以下查询来监控应用状态：

```bash
# 查找错误日志
docker logs gtd-app 2>&1 | grep '"level":"ERROR"'

# 查找特定用户的操作
docker logs gtd-app 2>&1 | grep '"userId":"user_123"'

# 查找慢查询（超过1000ms）
docker logs gtd-app 2>&1 | grep '"duration":[0-9]\{4,\}'

# 查找API错误
docker logs gtd-app 2>&1 | grep '"type":"api"' | grep '"level":"ERROR"'
```

### 性能监控

监控以下关键指标：
- API 响应时间
- 数据库查询时间
- 错误率
- 用户操作频率

## 故障排除

### 常见问题

1. **日志不显示时间戳**
   - 检查 `LOG_FORMAT` 环境变量
   - 确认 Docker 容器时区设置

2. **日志级别过高/过低**
   - 调整 `LOG_LEVEL` 环境变量
   - 重启应用使配置生效

3. **日志文件过大**
   - 检查 Docker 日志轮转配置
   - 考虑降低日志级别

### 调试模式

开发环境启用详细日志：
```bash
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

这将显示所有数据库查询、API调用和详细的调试信息。

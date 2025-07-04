# 日志系统使用说明

## 概述

项目集成了完整的日志系统，支持控制台输出和文件输出，具备日志轮转和本地映射功能。

## 日志配置

### 环境变量

```bash
# 日志级别 (debug|info|warn|error)
LOG_LEVEL=info

# 日志格式 (json|pretty)
LOG_FORMAT=json

# 日志目录
LOG_DIR=/app/logs
```

### Docker 配置

```yaml
# docker-compose.yml
volumes:
  - ./logs:/app/logs  # 映射日志目录到本地
environment:
  - LOG_DIR=/app/logs
```

## 日志输出

### 双重输出
- **控制台输出**: 通过 Docker logs 查看
- **文件输出**: 保存到 `/app/logs/app.log`

### 输出格式
- **开发环境**: 彩色美化输出
- **生产环境**: JSON 格式

## 日志查看

### 1. Docker 日志
```bash
# 实时查看
docker logs -f gtd-app

# 查看最近100行
docker logs --tail 100 gtd-app
```

### 2. 本地文件日志
```bash
# 使用日志查看脚本
./scripts/log-viewer.sh -f          # 实时跟踪
./scripts/log-viewer.sh -n 50       # 显示最后50行
./scripts/log-viewer.sh -s "ERROR"  # 搜索错误日志
./scripts/log-viewer.sh -l ERROR    # 只显示ERROR级别
./scripts/log-viewer.sh --list      # 列出所有日志文件
```

### 3. 直接查看文件
```bash
# 查看当前日志
tail -f ./logs/app.log

# 查看历史日志
zcat ./logs/app.log.1.gz
```

## 日志轮转

### 自动轮转
- **Docker 层面**: 单文件最大50MB，保留5个文件
- **应用层面**: 可通过脚本手动轮转

### 手动轮转
```bash
# 执行日志轮转
./scripts/log-rotate.sh

# 配置轮转参数
LOG_MAX_SIZE=100M LOG_MAX_FILES=10 ./scripts/log-rotate.sh
```

## 日志模块

系统提供了专用的日志记录器：

- `loggers.app` - 应用层日志
- `loggers.api` - API调用日志  
- `loggers.trpc` - tRPC操作日志
- `loggers.db` - 数据库操作日志
- `loggers.docker` - Docker容器日志
- `loggers.health` - 健康检查日志

## 使用示例

### 在代码中记录日志
```typescript
import { loggers, logError, logPerformance } from "@/utils/logger";

// 模块日志
loggers.api.info("API调用成功");

// 错误日志
logError(loggers.db, error, { operation: "create", table: "tasks" });

// 性能日志
logPerformance(loggers.app, "数据处理", 150, { recordCount: 100 });
```

### 查看特定模块日志
```bash
# 查看 API 模块日志
./scripts/log-viewer.sh -m "API"

# 查看错误日志
./scripts/log-viewer.sh -l ERROR

# 查看指定时间范围
./scripts/log-viewer.sh -t "2024-01-01 00:00:00,2024-01-01 23:59:59"
```

## 故障排查

### 日志文件不存在
1. 检查容器是否正常启动
2. 检查日志目录权限
3. 检查 volume 映射配置

### 日志轮转失败
1. 检查磁盘空间
2. 检查文件权限
3. 查看轮转脚本输出

### 性能问题
1. 调整日志级别到 `warn` 或 `error`
2. 增加日志轮转频率
3. 监控磁盘使用情况

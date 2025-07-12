# 管理员权限设置指南

## 概述

系统使用基于用户设置中的 `role` 字段的简单权限管理机制。用户角色存储在用户设置的JSON字段中，支持 `user`（普通用户）和 `admin`（管理员）两种角色。

## 设置管理员

### 方法一：使用脚本（推荐）

1. **设置管理员**
   ```bash
   node scripts/setup-admin.js admin@example.com
   ```

2. **列出所有管理员**
   ```bash
   node scripts/setup-admin.js --list
   ```

3. **查看帮助**
   ```bash
   node scripts/setup-admin.js
   ```

### 方法二：直接修改数据库

如果需要手动修改，可以直接更新用户的 `settings` 字段：

```sql
UPDATE "User" 
SET settings = jsonb_set(
  COALESCE(settings::jsonb, '{}'::jsonb), 
  '{role}', 
  '"admin"'
) 
WHERE email = 'admin@example.com';
```

## 权限说明

### 普通用户权限
- 访问个人设置页面 (`/settings`)
- 管理个人任务、笔记、日记
- 使用搜索功能
- 查看统计分析

### 管理员额外权限
- 访问系统管理页面 (`/admin/scheduler`)
- 查看和管理定时任务调度器
- 手动执行系统级任务
- 监控系统运行状态

## 权限检查机制

### API层面
- `protectedProcedure`: 检查用户是否登录
- `adminProcedure`: 检查用户是否登录且为管理员

### 前端层面
- 导航菜单动态显示（非管理员不显示系统管理菜单）
- 页面级权限检查（访问管理员页面时验证权限）
- 设置页面显示管理员标识

## 使用示例

### 1. 首次设置管理员

```bash
# 假设你的邮箱是 admin@example.com
node scripts/setup-admin.js admin@example.com
```

输出示例：
```
🔧 正在设置 admin@example.com 为管理员...
✅ 用户 Admin User (admin@example.com) 已设置为管理员

🎉 设置完成！用户现在可以访问管理员功能:
  - 定时任务管理: /admin/scheduler
  - 系统设置管理

📋 当前所有管理员:
  - Admin User (admin@example.com)
```

### 2. 验证管理员权限

1. 登录系统
2. 访问 `/settings` 页面
3. 在"日记自动生成"选项卡底部应该看到"管理员设置"区域
4. 左侧导航菜单中应该显示"系统管理"选项
5. 访问 `/admin/scheduler` 应该能正常显示管理页面

### 3. 移除管理员权限

目前需要手动修改数据库或使用工具函数：

```javascript
// 在 Node.js 环境中
const { removeUserAdminRole } = require('./src/server/utils/admin-setup');
await removeUserAdminRole('user@example.com');
```

## 安全注意事项

1. **谨慎授予管理员权限**：管理员可以访问系统级功能
2. **定期审查管理员列表**：使用 `--list` 参数查看当前管理员
3. **日志监控**：管理员操作会记录在系统日志中
4. **备份重要数据**：在进行系统级操作前确保数据备份

## 故障排除

### 问题：设置管理员后仍无法访问管理页面

**解决方案：**
1. 确认用户已重新登录（权限检查基于会话）
2. 检查浏览器缓存，尝试硬刷新
3. 验证数据库中的设置是否正确更新

### 问题：脚本提示用户不存在

**解决方案：**
1. 确认用户已通过OAuth登录过系统
2. 检查邮箱地址是否正确
3. 查看数据库中的用户记录

### 问题：权限检查失败

**解决方案：**
1. 检查用户设置的JSON格式是否正确
2. 确认 `role` 字段值为 `"admin"`
3. 重启应用服务器以确保权限中间件正常工作

## 开发说明

### 添加新的管理员功能

1. 在API路由中使用 `adminProcedure` 而不是 `protectedProcedure`
2. 在前端页面添加权限检查
3. 更新导航配置以控制菜单显示

### 扩展权限系统

如果需要更复杂的权限系统，可以考虑：
- 添加更多角色类型
- 实现基于资源的权限控制
- 添加权限继承机制

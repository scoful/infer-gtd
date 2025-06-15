# LLM 驱动的智能 Todo 与个人知识管理应用 - 开发检查清单

**最后更新时间**: 2025年6月15日 16:00
**代码检查日期**: 2025年6月15日
**项目状态**: 基础架构已完成，核心业务功能待开发

## 项目概述

**产品名称**: LLM 驱动的智能 Todo 与个人知识管理应用
**技术栈**: Next.js 15 + tRPC + Prisma + PostgreSQL + TypeScript + Tailwind CSS v4
**开发模式**: T3 Stack 脚手架，全栈应用
**目标**: 构建智能化的个人效率和知识管理平台

## 技术架构概览

```
Frontend (Next.js 15)
├── Pages Router (主要路由)
├── App Router (新功能)
└── Tailwind CSS v4 (样式)

Backend (tRPC + Prisma)
├── tRPC API (类型安全)
├── NextAuth.js (身份认证)
└── Prisma ORM (数据访问)

Database (PostgreSQL)
├── 用户管理
├── 任务管理
├── 笔记管理
└── 日志管理
```

---

## 第一阶段：数据库设计与基础架构 (P0 - 高优先级)

### 1.1 Prisma 数据库模型设计 【复杂度: 中等】

#### 1.1.1 用户认证模型 (NextAuth.js 标准)
- [x] **User 模型** - 用户基础信息 ✅ *已完成*
  - `id`, `name`, `email`, `image`, `emailVerified` - 标准 NextAuth 字段已实现
  - 关联: `accounts`, `sessions` 已实现，`tasks`, `notes`, `journals` 待添加
- [x] **Account 模型** - OAuth 账户信息 ✅ *已完成*
- [x] **Session 模型** - 用户会话管理 ✅ *已完成*
- [x] **VerificationToken 模型** - 邮箱验证 ✅ *已完成*

#### 1.1.2 核心业务模型
- [ ] **Task 模型** - 任务管理核心 ⬜ *待开发*
  ```prisma
  model Task {
    id          String    @id @default(cuid())
    title       String
    description String?
    status      TaskStatus @default(IDEA)
    type        TaskType   @default(IDEA)
    priority    Priority?
    dueDate     DateTime?
    dueTime     String?
    completedAt DateTime?
    completedCount Int     @default(0)
    totalTimeSpent Int     @default(0) // 秒
    isRecurring Boolean   @default(false)
    recurringPattern String?

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    createdBy   User      @relation(fields: [createdById], references: [id])
    createdById String

    project     Project?  @relation(fields: [projectId], references: [id])
    projectId   String?

    tags        TaskTag[]
    timeEntries TimeEntry[]
    statusHistory TaskStatusHistory[]

    @@index([createdById])
    @@index([status])
    @@index([dueDate])
  }
  ```

- [ ] **Note 模型** - 知识沉淀笔记 ⬜ *待开发*
  ```prisma
  model Note {
    id          String    @id @default(cuid())
    title       String
    content     String    // Markdown 内容

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    createdBy   User      @relation(fields: [createdById], references: [id])
    createdById String

    project     Project?  @relation(fields: [projectId], references: [id])
    projectId   String?

    tags        NoteTag[]
    linkedTasks Task[]    // 关联的任务

    @@index([createdById])
    @@index([title])
  }
  ```

- [ ] **Journal 模型** - 日志管理 ⬜ *待开发*
  ```prisma
  model Journal {
    id          String    @id @default(cuid())
    date        DateTime  @unique // 每日唯一
    content     String    // Markdown 内容
    template    String?   // 使用的模板

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    createdBy   User      @relation(fields: [createdById], references: [id])
    createdById String

    @@index([createdById])
    @@index([date])
  }
  ```

#### 1.1.3 辅助模型
- [ ] **Project 模型** - 项目/领域分类 ⬜ *待开发*
- [ ] **Tag 模型** - 标签系统 ⬜ *待开发*
- [ ] **TaskTag, NoteTag 模型** - 多对多关联 ⬜ *待开发*
- [ ] **TimeEntry 模型** - 时间追踪记录 ⬜ *待开发*
- [ ] **TaskStatusHistory 模型** - 任务状态变更历史 ⬜ *待开发*

#### 1.1.4 枚举定义
- [ ] **TaskStatus 枚举**: `IDEA`, `TODO`, `IN_PROGRESS`, `WAITING`, `DONE`, `ARCHIVED` ⬜ *待开发*
- [ ] **TaskType 枚举**: `IDEA`, `ACTION` ⬜ *待开发*
- [ ] **Priority 枚举**: `LOW`, `MEDIUM`, `HIGH`, `URGENT` ⬜ *待开发*

### 1.2 数据库迁移与种子数据 【复杂度: 简单】
- [x] 创建初始 Prisma 迁移文件 ✅ *已完成* - 基础 NextAuth 模型已迁移
- [ ] 编写种子数据脚本 (`prisma/seed.ts`) ⬜ *待开发*
- [x] 配置开发环境数据库连接 ✅ *已完成* - PostgreSQL 配置完成
- [ ] 验证数据库模型关系完整性 🔄 *部分完成* - 需要添加业务模型后验证

---

## 第二阶段：后端 API 开发 (tRPC) 【P0 - 高优先级】

### 2.1 认证与授权系统 【复杂度: 中等】
- [x] **NextAuth.js 配置** ✅ *已完成*
  - [x] 配置 GitHub OAuth 提供商 ✅ *已完成*
  - [x] 设置 Prisma 适配器 ✅ *已完成*
  - [x] 配置会话策略和回调 ✅ *已完成*
- [x] **tRPC 认证中间件** ✅ *已完成*
  - [x] `protectedProcedure` 实现 ✅ *已完成*
  - [x] 用户会话验证 ✅ *已完成*
  - [x] 权限检查机制 ✅ *已完成*

### 2.2 任务管理 API 路由 【复杂度: 高】
- [ ] **taskRouter 基础 CRUD** ⬜ *待开发*
  ```typescript
  // src/server/api/routers/task.ts
  export const taskRouter = createTRPCRouter({
    // 查询操作
    getAll: protectedProcedure.query(),
    getById: protectedProcedure.input().query(),
    getByStatus: protectedProcedure.input().query(),

    // 变更操作
    create: protectedProcedure.input().mutation(),
    update: protectedProcedure.input().mutation(),
    delete: protectedProcedure.input().mutation(),
    updateStatus: protectedProcedure.input().mutation(),
  });
  ```

- [ ] **任务状态管理 API** ⬜ *待开发*
  - `updateStatus` - 状态流转逻辑
  - `restartTask` - 重启已完成任务
  - `archiveTask` - 归档任务
  - 状态变更历史记录

- [ ] **重复任务 API** ⬜ *待开发*
  - `setRecurring` - 设置重复模式
  - `generateNextInstance` - 生成下一个实例
  - `getRecurringStats` - 重复任务统计

- [ ] **时间追踪 API** ⬜ *待开发*
  - `startTimer` - 开始计时
  - `pauseTimer` - 暂停计时
  - `stopTimer` - 停止计时
  - `getTimeStats` - 时间统计

### 2.3 笔记管理 API 路由 【复杂度: 中等】
- [ ] **noteRouter 基础功能** ⬜ *待开发*
  ```typescript
  // src/server/api/routers/note.ts
  export const noteRouter = createTRPCRouter({
    getAll: protectedProcedure.query(),
    getById: protectedProcedure.input().query(),
    create: protectedProcedure.input().mutation(),
    update: protectedProcedure.input().mutation(),
    delete: protectedProcedure.input().mutation(),
    linkToTask: protectedProcedure.input().mutation(),
  });
  ```

- [ ] **Markdown 内容处理** ⬜ *待开发*
  - 内容验证和清理
  - 图片上传支持 (未来)
  - 内部链接解析

### 2.4 日志管理 API 路由 【复杂度: 中等】
- [ ] **journalRouter 功能** ⬜ *待开发*
  ```typescript
  // src/server/api/routers/journal.ts
  export const journalRouter = createTRPCRouter({
    getByDate: protectedProcedure.input().query(),
    getDateRange: protectedProcedure.input().query(),
    createOrUpdate: protectedProcedure.input().mutation(),
    getTemplate: protectedProcedure.query(),
  });
  ```

- [ ] **日志模板系统** ⬜ *待开发*
  - 默认模板配置
  - 自定义模板支持
  - 模板变量替换

### 2.5 搜索与统计 API 【复杂度: 中等】
- [ ] **searchRouter 全局搜索** ⬜ *待开发*
  ```typescript
  // src/server/api/routers/search.ts
  export const searchRouter = createTRPCRouter({
    global: protectedProcedure.input().query(),
    tasks: protectedProcedure.input().query(),
    notes: protectedProcedure.input().query(),
    journals: protectedProcedure.input().query(),
  });
  ```

- [ ] **analyticsRouter 数据统计** ⬜ *待开发*
  - 任务完成统计
  - 时间使用分析
  - 活动趋势报告

### 2.6 输入验证 Schema (Zod) 【复杂度: 简单】
- [ ] **任务相关 Schema** ⬜ *待开发*
  ```typescript
  // src/server/api/schemas/task.ts
  export const createTaskSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    type: z.enum(['IDEA', 'ACTION']),
    dueDate: z.date().optional(),
    projectId: z.string().optional(),
  });
  ```

- [ ] **笔记相关 Schema** ⬜ *待开发*
- [ ] **日志相关 Schema** ⬜ *待开发*
- [ ] **搜索相关 Schema** ⬜ *待开发*

---

## 第三阶段：前端界面开发 【P0-P1 混合优先级】

### 3.1 核心布局与导航 【复杂度: 中等】
- [ ] **主布局组件** (`src/components/Layout/MainLayout.tsx`) ⬜ *待开发*
  - 响应式侧边栏导航
  - 顶部用户信息栏
  - 移动端适配

- [ ] **导航组件** ⬜ *待开发*
  - 主导航菜单 (思绪流、看板、笔记、日志)
  - 快速操作按钮
  - 全局搜索入口 (`Ctrl+Shift+F`)

### 3.2 任务管理界面 【复杂度: 高】
- [ ] **看板视图** (`src/pages/tasks/kanban.tsx`) ⬜ *待开发*
  ```typescript
  // 看板列: 想法 | 待办 | 进行中 | 等待中 | 已完成
  interface KanbanColumn {
    status: TaskStatus;
    title: string;
    tasks: Task[];
  }
  ```
  - 拖拽排序功能 (react-beautiful-dnd)
  - 任务卡片组件
  - 状态流转动画

- [ ] **任务详情模态框** ⬜ *待开发*
  - 任务编辑表单
  - 时间追踪控件
  - 状态变更历史
  - 关联笔记显示

- [ ] **任务列表视图** (`src/pages/tasks/list.tsx`) ⬜ *待开发*
  - 筛选和排序功能
  - 批量操作
  - 截止日期提醒

- [ ] **思绪流视图** (`src/pages/stream.tsx`) ⬜ *待开发*
  - 时间轴布局
  - 想法快速捕捉
  - 转化为行动按钮

### 3.3 笔记管理界面 【复杂度: 高】
- [ ] **Markdown 编辑器** (`src/components/Editor/MarkdownEditor.tsx`) ⬜ *待开发*
  ```typescript
  // JetBrains 快捷键支持
  const shortcuts = {
    'Ctrl+D': duplicateLine,
    'Ctrl+Y': deleteLine,
    'Ctrl+Shift+ArrowUp': moveLineUp,
    'Ctrl+Shift+ArrowDown': moveLineDown,
  };
  ```
  - 实时预览功能
  - 语法高亮
  - 快捷键绑定

- [ ] **笔记列表** (`src/pages/notes/index.tsx`) ⬜ *待开发*
  - 网格/列表切换
  - 标签筛选
  - 搜索功能

- [ ] **笔记详情页** (`src/pages/notes/[id].tsx`) ⬜ *待开发*
  - 全屏编辑模式
  - 关联任务显示
  - 版本历史 (未来)

### 3.4 日志管理界面 【复杂度: 中等】
- [ ] **日志编辑器** (`src/pages/journal/[date].tsx`) ⬜ *待开发*
  - 日期选择器
  - 模板应用
  - 自动保存功能

- [ ] **日志时间线** (`src/pages/journal/timeline.tsx`) ⬜ *待开发*
  - 日历视图
  - 月度/年度切换
  - 快速预览

### 3.5 搜索与回顾界面 【复杂度: 中等】
- [ ] **全局搜索组件** (`src/components/Search/GlobalSearch.tsx`) ⬜ *待开发*
  - 模糊搜索
  - 结果分类显示
  - 快捷键支持

- [ ] **时间回顾仪表盘** (`src/pages/analytics.tsx`) ⬜ *待开发*
  - 任务完成统计图表
  - 时间使用分析
  - 活动热力图

### 3.6 自定义 Hooks 【复杂度: 中等】
- [ ] **useTaskManagement** - 任务操作逻辑 ⬜ *待开发*
- [ ] **useNoteEditor** - 笔记编辑逻辑 ⬜ *待开发*
- [ ] **useKeyboardShortcuts** - 快捷键管理 ⬜ *待开发*
- [ ] **useTimeTracking** - 时间追踪逻辑 ⬜ *待开发*
- [ ] **useLocalStorage** - 本地状态持久化 ⬜ *待开发*

---

## 第四阶段：高级功能与优化 【P1-P2 优先级】

### 4.1 多模态输入支持 【复杂度: 高】
- [ ] **语音转文本** (P1)
  - Web Speech API 集成
  - 语音录制组件
  - 转录结果处理

- [ ] **图片 OCR** (P2)
  - 图片上传组件
  - OCR 服务集成
  - 文本提取和处理

### 4.2 LLM 智能功能 【复杂度: 高】
- [ ] **LLM 服务集成** (P2)
  - API 代理层设计
  - 多提供商支持 (OpenAI, Gemini, Claude)
  - 请求限流和缓存

- [ ] **智能任务分解** (P2)
  - 想法分析和建议
  - 任务步骤生成
  - 智能标签推荐

### 4.3 性能优化 【复杂度: 中等】
- [ ] **React Query 缓存优化** (P1)
  - 智能缓存策略
  - 乐观更新
  - 后台同步

- [ ] **代码分割** (P1)
  - 路由级别分割
  - 组件懒加载
  - 动态导入优化

### 4.4 用户体验增强 【复杂度: 中等】
- [ ] **离线支持** (P2)
  - Service Worker 配置
  - 离线数据缓存
  - 同步机制

- [ ] **主题系统** (P2)
  - 深色/浅色模式
  - 自定义主题色
  - 用户偏好保存

---

## 第五阶段：测试与部署 【P0 优先级】

### 5.1 测试策略 【复杂度: 中等】
- [ ] **单元测试**
  - tRPC 路由测试
  - 工具函数测试
  - 组件单元测试

- [ ] **集成测试**
  - API 端到端测试
  - 数据库操作测试
  - 认证流程测试

- [ ] **E2E 测试**
  - 关键用户流程
  - 跨浏览器兼容性
  - 移动端适配测试

### 5.2 部署配置 【复杂度: 简单】
- [ ] **Vercel 部署配置**
  - 环境变量设置
  - 构建优化配置
  - 域名和 SSL 配置

- [ ] **数据库部署**
  - 生产数据库设置
  - 迁移脚本执行
  - 备份策略配置

- [ ] **CI/CD 流程**
  - GitHub Actions 配置
  - 自动化测试
  - 部署流水线

---

## 开发里程碑时间线

| 阶段 | 预计时间 | 主要交付物 |
|------|----------|------------|
| 第一阶段 | 1-2 周 | 数据库模型、基础架构 |
| 第二阶段 | 3-4 周 | 完整 tRPC API |
| 第三阶段 | 4-6 周 | MVP 前端界面 |
| 第四阶段 | 2-3 周 | 高级功能 |
| 第五阶段 | 1-2 周 | 测试与部署 |

**总预计开发时间**: 11-17 周

---

## 验收标准

### MVP 核心功能验收
- [ ] 用户可以创建、编辑、删除任务
- [ ] 任务状态流转正常工作
- [ ] 时间追踪功能准确记录
- [ ] Markdown 笔记编辑器支持 JetBrains 快捷键
- [ ] 日志按日期管理功能完整
- [ ] 全局搜索返回准确结果
- [ ] 响应式设计在移动端正常工作

### 性能标准
- [ ] 页面加载时间 < 2 秒
- [ ] API 响应时间 < 500ms
- [ ] 搜索响应时间 < 1 秒
- [ ] 支持 1000+ 任务/笔记无性能问题

### 安全标准
- [ ] 所有 API 端点正确验证用户权限
- [ ] 用户数据隔离完整
- [ ] 输入验证防止注入攻击
- [ ] HTTPS 和安全头配置正确

---

---

## 当前项目进度总结

### 📊 **整体进度概览**
- **项目初始化**: ✅ 100% 完成
- **基础架构**: ✅ 95% 完成 (缺少业务数据模型)
- **认证系统**: ✅ 100% 完成
- **核心业务功能**: ⬜ 0% 完成
- **前端界面**: ⬜ 5% 完成 (仅有默认页面)

### ✅ **已完成项目 (基础架构)**
1. **T3 Stack 项目初始化** - 完整的脚手架设置
2. **NextAuth.js 认证系统** - GitHub OAuth 完整配置
3. **Prisma 数据库设置** - PostgreSQL 连接和基础模型
4. **tRPC API 基础架构** - 完整的类型安全 API 设置
5. **开发环境配置** - TypeScript, ESLint, Prettier, Tailwind CSS
6. **环境变量管理** - 类型安全的环境变量配置

### 🔄 **当前技术债务**
1. **示例代码清理** - 需要移除 T3 默认的 Post 模型和相关代码
2. **业务数据模型** - 需要添加 Task, Note, Journal 等核心模型
3. **API 路由重构** - 需要将示例 postRouter 替换为业务路由

### ⬜ **下一步优先任务 (建议顺序)**
1. **数据库模型设计** (1-2周)
   - 设计并实现 Task, Note, Journal 模型
   - 添加相关的枚举和关联关系
   - 创建数据库迁移

2. **核心 API 开发** (2-3周)
   - 实现 taskRouter 基础 CRUD
   - 实现 noteRouter 基础功能
   - 实现 journalRouter 基础功能

3. **基础前端界面** (2-3周)
   - 创建主布局和导航
   - 实现任务看板视图
   - 实现基础的笔记编辑器

### 📈 **修订后的时间估算**
- **当前完成度**: ~15% (基础架构)
- **剩余开发时间**: 8-12周
- **MVP 预计完成**: 2025年8月底 - 9月初

### 🎯 **关键里程碑调整**
- **里程碑 1**: ✅ 基础架构完成 (已完成)
- **里程碑 2**: 数据库模型完成 (预计 2025年7月1日)
- **里程碑 3**: 核心 API 完成 (预计 2025年7月25日)
- **里程碑 4**: MVP 前端完成 (预计 2025年8月20日)
- **里程碑 5**: MVP 发布 (预计 2025年9月1日)

---

**注意**: 本检查清单基于 PRD v1.0 和当前技术栈生成，已根据 2025年6月15日的代码检查结果更新。应根据开发进展和需求变更持续更新。

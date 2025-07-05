-- 优化标签查询性能的索引
-- 添加复合索引以优化搜索和排序查询

-- 复合索引：用户ID + 标签名（优化搜索查询）
CREATE INDEX IF NOT EXISTS "Tag_createdById_name_idx" ON "Tag"("createdById", "name");

-- 复合索引：用户ID + 系统标签 + 类型 + 标签名（优化排序查询）
CREATE INDEX IF NOT EXISTS "Tag_createdById_isSystem_type_name_idx" ON "Tag"("createdById", "isSystem", "type", "name");

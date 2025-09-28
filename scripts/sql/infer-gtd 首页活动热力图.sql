infer-gtd 首页活动热力图
-- 统计2025-09-28当天的所有活动（考虑UTC+8时区）
-- UTC+8时区的2025-09-28对应UTC时间：2025-09-27 16:00:00 到 2025-09-28 15:59:59

WITH daily_activities AS (
  -- 任务创建
  SELECT 
    'task_created' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Task"
  WHERE "createdAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "createdAt" < '2025-09-28 16:00:00'::timestamp
  
  UNION ALL
  
  -- 任务完成
  SELECT 
    'task_completed' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Task"
  WHERE "completedAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "completedAt" < '2025-09-28 16:00:00'::timestamp
    AND "completedAt" IS NOT NULL
  
  UNION ALL
  
  -- 笔记创建
  SELECT 
    'note_created' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Note"
  WHERE "createdAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "createdAt" < '2025-09-28 16:00:00'::timestamp
  
  UNION ALL
  
  -- 日记创建
  SELECT 
    'journal_created' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Journal"
  WHERE "createdAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "createdAt" < '2025-09-28 16:00:00'::timestamp
  
  UNION ALL
  
  -- 任务更新
  SELECT 
    'task_updated' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Task"
  WHERE "updatedAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "updatedAt" < '2025-09-28 16:00:00'::timestamp
    AND "updatedAt" != "createdAt"
  
  UNION ALL
  
  -- 笔记更新
  SELECT 
    'note_updated' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Note"
  WHERE "updatedAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "updatedAt" < '2025-09-28 16:00:00'::timestamp
    AND "updatedAt" != "createdAt"
  
  UNION ALL
  
  -- 日记更新
  SELECT 
    'journal_updated' AS activity_type,
    COUNT(*) AS activity_count
  FROM "Journal"
  WHERE "updatedAt" >= '2025-09-27 16:00:00'::timestamp 
    AND "updatedAt" < '2025-09-28 16:00:00'::timestamp
    AND "updatedAt" != "createdAt"
)
SELECT 
  activity_type,
  activity_count,
  SUM(activity_count) OVER() AS total_activities
FROM daily_activities
WHERE activity_count > 0
ORDER BY activity_type;

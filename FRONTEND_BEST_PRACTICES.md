# 前端开发最佳实践指南

> 基于任务管理、笔记管理、日记管理模块的实现经验总结

**最后更新**: 2025年7月3日  
**项目**: Infer GTD - LLM 驱动的智能 Todo 与个人知识管理应用

---

## 📋 目录

1. [分页逻辑模式](#1-分页逻辑模式)
2. [确认对话逻辑](#2-确认对话逻辑)
3. [数据刷新策略](#3-数据刷新策略)
4. [状态管理模式](#4-状态管理模式)
5. [用户体验细节](#5-用户体验细节)
6. [组件设计模式](#6-组件设计模式)

---

## 1. 分页逻辑模式

### 1.1 标准 useInfiniteQuery 模式

**核心配置**：
- 每页限制：20条记录
- 缓存时间：30秒
- 分页方式：cursor-based 分页

```typescript
// 标准分页查询配置
const {
  data: itemsData,
  isLoading,
  isFetching,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  refetch,
} = api.item.getAll.useInfiniteQuery(queryParams, {
  enabled: !!sessionData,
  staleTime: 30 * 1000, // 30秒缓存
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### 1.2 数据处理模式

```typescript
// 数据合并处理
const items = itemsData?.pages.flatMap((page) => page.items) ?? [];
const totalCount = itemsData?.pages[0]?.totalCount ?? 0;
```

### 1.3 加载更多按钮

```typescript
// 统一的加载更多按钮实现
{hasNextPage && (
  <div className="mt-8 flex justify-center">
    <button
      onClick={() => void fetchNextPage()}
      disabled={isFetchingNextPage}
      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isFetchingNextPage ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
          加载中...
        </>
      ) : (
        "加载更多"
      )}
    </button>
  </div>
)}
```

### 1.4 后端 cursor-based 分页

```typescript
// 后端分页实现模式
const items = await ctx.db.item.findMany({
  where,
  take: limit + 1, // 多取1条用于判断是否有下一页
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: "desc" },
});

let nextCursor: typeof cursor | undefined = undefined;
if (items.length > limit) {
  const nextItem = items.pop(); // 移除多余的一条
  nextCursor = nextItem!.id;    // 设置下一页游标
}

return {
  items,
  nextCursor,
  totalCount,
};
```

---

## 2. 确认对话逻辑

### 2.1 useConfirm Hook 标准模式

```typescript
// Hook 使用模式
const { confirmState, showConfirm, hideConfirm, setLoading } = useConfirm();

// 危险操作确认
const handleDelete = async (id: string) => {
  const confirmed = await showConfirm({
    title: "确认删除",
    message: "确定要删除这个项目吗？删除后无法恢复。",
    confirmText: "删除",
    cancelText: "取消",
    type: "danger",
  });

  if (!confirmed) return;

  try {
    setLoading(true);
    await deleteMutation.mutateAsync({ id });
  } catch (error) {
    console.error("删除失败:", error);
  } finally {
    setLoading(false);
    hideConfirm();
  }
};
```

### 2.2 批量操作确认

```typescript
// 批量操作确认模式
const handleBatchDelete = async () => {
  if (selectedItems.size === 0) return;

  const itemCount = selectedItems.size;
  const confirmed = await showConfirm({
    title: "确认批量删除",
    message: `确定要删除选中的 ${itemCount} 个项目吗？\n\n删除后无法恢复，请谨慎操作。`,
    confirmText: "删除",
    cancelText: "取消",
    type: "danger",
  });

  if (confirmed) {
    await batchDeleteMutation.mutateAsync({
      itemIds: Array.from(selectedItems),
    });
  }
};
```

### 2.3 确认模态框组件

```typescript
// 页面中的确认模态框
<ConfirmModal
  isOpen={confirmState.isOpen}
  onClose={hideConfirm}
  onConfirm={confirmState.onConfirm}
  title={confirmState.title}
  message={confirmState.message}
  confirmText={confirmState.confirmText}
  cancelText={confirmState.cancelText}
  type={confirmState.type}
  isLoading={confirmState.isLoading}
/>
```

---

## 3. 数据刷新策略

### 3.1 Mutation 缓存失效模式

```typescript
// 标准 mutation 配置
const createMutation = api.item.create.useMutation({
  onSuccess: () => {
    void utils.item.getAll.invalidate(); // 失效列表缓存
    showSuccess("创建成功");
    onSuccess?.();
    onClose();
  },
  onError: (error) => {
    showError(`创建失败: ${error.message}`);
  },
});

const updateMutation = api.item.update.useMutation({
  onSuccess: () => {
    void utils.item.getAll.invalidate(); // 失效列表缓存
    void utils.item.getById.invalidate(); // 失效详情缓存
    showSuccess("更新成功");
  },
});
```

### 3.2 乐观更新模式

```typescript
// 乐观更新状态管理
const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Status>>({});

const handleStatusChange = async (itemId: string, newStatus: Status) => {
  // 立即进行乐观更新
  setOptimisticUpdates(prev => ({
    ...prev,
    [itemId]: newStatus,
  }));

  try {
    await updateStatusMutation.mutateAsync({ id: itemId, status: newStatus });
  } catch (error) {
    // 错误时回滚乐观更新
    setOptimisticUpdates(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  }
};
```

### 3.3 分层缓存策略

```typescript
// 不同数据的缓存策略
const queries = {
  // 频繁变化的数据：短缓存
  list: api.item.getAll.useQuery(params, {
    staleTime: 30 * 1000, // 30秒
  }),
  
  // 相对稳定的数据：长缓存
  projects: api.project.getAll.useQuery({ limit: 100 }, {
    staleTime: 5 * 60 * 1000, // 5分钟
  }),
  
  // 首页数据：中等缓存，不自动刷新
  dashboard: api.stats.getDashboard.useQuery(undefined, {
    staleTime: 2 * 60 * 1000, // 2分钟
    refetchOnWindowFocus: false,
  }),
};
```

---

## 4. 状态管理模式

### 4.1 模态框状态管理

```typescript
// 标准模态框 Props 接口
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId?: string; // 编辑模式的 ID
  onSuccess?: () => void;
}

// 模态框状态管理
const [isModalOpen, setIsModalOpen] = useState(false);
const [editingItemId, setEditingItemId] = useState<string | null>(null);

const handleEdit = (itemId: string) => {
  setEditingItemId(itemId);
  setIsModalOpen(true);
};

const handleModalClose = () => {
  setIsModalOpen(false);
  setEditingItemId(null);
};
```

### 4.2 表单状态管理

```typescript
// 表单数据接口定义
interface FormData {
  title: string;
  content: string;
  projectId?: string;
  tagIds: string[];
}

// 表单状态管理
const [formData, setFormData] = useState<FormData>({
  title: "",
  content: "",
  tagIds: [],
});

// 表单重置函数
const resetForm = () => {
  setFormData({
    title: "",
    content: "",
    tagIds: [],
  });
};

// 编辑模式数据填充
useEffect(() => {
  if (isOpen) {
    if (isEditing && itemDetail) {
      setFormData({
        title: itemDetail.title,
        content: itemDetail.content,
        projectId: itemDetail.projectId ?? undefined,
        tagIds: itemDetail.tags.map(t => t.tag.id),
      });
    } else {
      resetForm();
    }
  }
}, [isOpen, isEditing, itemDetail]);
```

### 4.3 编辑状态管理

```typescript
// 编辑状态判断
const isEditing = !!itemId;

// 条件查询（仅编辑模式）
const { data: itemDetail } = api.item.getById.useQuery(
  { id: itemId! },
  {
    enabled: isEditing && isOpen,
    refetchOnMount: true,
    staleTime: 0,
  }
);

// 条件渲染
{isEditing ? (
  <h2>编辑项目</h2>
) : (
  <h2>创建项目</h2>
)}
```

---

## 5. 用户体验细节

### 5.1 分层加载状态

```typescript
// 页面级加载
<QueryLoading
  isLoading={isLoading}
  error={error}
  loadingMessage="加载数据中..."
  loadingComponent={<SectionLoading message="加载数据中..." />}
>
  {/* 页面内容 */}
</QueryLoading>

// 按钮级加载
<ButtonLoading
  isLoading={isSubmitting}
  loadingText="保存中..."
  className="w-full"
>
  保存
</ButtonLoading>

// 区域级加载
{isFetching && (
  <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
    <LoadingSpinner size="md" />
  </div>
)}
```

### 5.2 错误处理机制

```typescript
// 统一错误处理
const { showSuccess, showError, showWarning } = useGlobalNotifications();

// Mutation 错误处理
const mutation = api.item.create.useMutation({
  onSuccess: (result) => {
    showSuccess(`项目 "${result.title}" 创建成功`);
  },
  onError: (error) => {
    if (error.data?.code === "CONFLICT") {
      showWarning("项目名称已存在，请使用其他名称");
    } else {
      showError(error.message ?? "创建失败");
    }
  },
});

// 表单验证错误
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.title.trim()) {
    showError("标题不能为空");
    return;
  }

  if (formData.title.length > 100) {
    showError("标题长度不能超过100个字符");
    return;
  }

  // 提交逻辑...
};
```

### 5.3 自动保存逻辑

```typescript
// 自动保存配置
<MarkdownEditor
  value={content}
  onChange={setContent}
  autoSave={true}
  autoSaveType="local" // 或 "server"
  onAutoSave={handleAutoSave}
  placeholder="开始编写内容..."
/>

// 本地草稿保存
const handleAutoSave = (content: string) => {
  const draftData = {
    title: formData.title,
    content: content,
    projectId: formData.projectId,
  };

  const draftKey = `item-draft-${itemId || 'new'}`;
  try {
    localStorage.setItem(draftKey, JSON.stringify(draftData));
    console.log("✅ 草稿已保存到本地");
  } catch (error) {
    console.error("❌ 保存草稿失败:", error);
  }
};

// 服务器自动保存
const autoSaveMutation = api.item.update.useMutation({
  onSuccess: () => {
    console.log("✅ 自动保存成功");
    // 不显示通知，避免打扰用户
  },
  onError: (error) => {
    console.error("❌ 自动保存失败:", error.message);
    // 自动保存失败也不显示错误通知
  },
});
```

### 5.4 加载状态指示器

```typescript
// 保存状态指示
const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

// 状态指示器组件
const SaveStatusIndicator = ({ status }: { status: typeof saveStatus }) => {
  const statusConfig = {
    saved: { text: "已保存", color: "text-green-600", icon: "✓" },
    saving: { text: "保存中...", color: "text-blue-600", icon: "⟳" },
    unsaved: { text: "未保存", color: "text-orange-600", icon: "●" },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center text-xs ${config.color}`}>
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </div>
  );
};
```

---

## 6. 组件设计模式

### 6.1 Props 接口设计规范

```typescript
// 基础组件 Props 接口
interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
}

// 数据组件 Props 接口
interface DataComponentProps<T> {
  data: T;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// 交互组件 Props 接口
interface InteractiveComponentProps {
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (selected: boolean) => void;
  isSelected?: boolean;
}

// 完整的组件 Props 示例
interface ItemCardProps extends BaseComponentProps, InteractiveComponentProps {
  item: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  };
  viewMode: "list" | "grid";
  showActions?: boolean;
}
```

### 6.2 事件处理模式

```typescript
// 事件处理函数命名规范
const handleEdit = useCallback((itemId: string) => {
  setEditingItemId(itemId);
  setIsModalOpen(true);
}, []);

const handleDelete = useCallback(async (itemId: string) => {
  const confirmed = await showConfirm({
    title: "确认删除",
    message: "确定要删除这个项目吗？",
    type: "danger",
  });

  if (confirmed) {
    await deleteMutation.mutateAsync({ id: itemId });
  }
}, [deleteMutation, showConfirm]);

// 批量操作处理
const handleBatchAction = useCallback((action: string) => {
  const selectedIds = Array.from(selectedItems);

  switch (action) {
    case "delete":
      void handleBatchDelete(selectedIds);
      break;
    case "archive":
      void handleBatchArchive(selectedIds);
      break;
    default:
      console.warn("未知的批量操作:", action);
  }
}, [selectedItems, handleBatchDelete, handleBatchArchive]);
```

### 6.3 组合模式设计

```typescript
// 高阶组件模式
export const withLoading = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return function WithLoadingComponent(props: P & { isLoading: boolean }) {
    const { isLoading, ...restProps } = props;

    if (isLoading) {
      return <LoadingSpinner />;
    }

    return <WrappedComponent {...(restProps as P)} />;
  };
};

// Hook 组合模式
export function useItemManagement() {
  const utils = api.useUtils();
  const { showSuccess, showError } = useGlobalNotifications();
  const { showConfirm } = useConfirm();

  const createMutation = api.item.create.useMutation({
    onSuccess: () => {
      void utils.item.getAll.invalidate();
      showSuccess("创建成功");
    },
  });

  const deleteMutation = api.item.delete.useMutation({
    onSuccess: () => {
      void utils.item.getAll.invalidate();
      showSuccess("删除成功");
    },
  });

  const handleCreate = useCallback((data: CreateItemInput) => {
    createMutation.mutate(data);
  }, [createMutation]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await showConfirm({
      title: "确认删除",
      message: "确定要删除这个项目吗？",
      type: "danger",
    });

    if (confirmed) {
      deleteMutation.mutate({ id });
    }
  }, [deleteMutation, showConfirm]);

  return {
    create: handleCreate,
    delete: handleDelete,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// 渲染组件模式
interface RenderProps<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  children: (props: {
    items: T[];
    isLoading: boolean;
    hasError: boolean;
  }) => ReactNode;
}

export function DataRenderer<T>({ data, isLoading, error, children }: RenderProps<T>) {
  return (
    <>
      {children({
        items: data,
        isLoading,
        hasError: !!error,
      })}
    </>
  );
}
```

---

## 📚 使用指南

### 快速开始

1. **新建列表页面**：参考分页逻辑模式 + 数据刷新策略
2. **新建模态框**：参考状态管理模式 + 确认对话逻辑
3. **新建表单组件**：参考组件设计模式 + 用户体验细节

### 代码检查清单

- [ ] 是否使用了标准的分页配置？
- [ ] 是否实现了确认对话框？
- [ ] 是否配置了合适的缓存策略？
- [ ] 是否有完整的加载和错误状态？
- [ ] 是否有自动保存功能？
- [ ] 是否遵循了 Props 接口规范？

### 性能优化建议

1. **合理使用缓存**：根据数据变化频率设置不同的 `staleTime`
2. **避免过度渲染**：使用 `useCallback` 和 `useMemo` 优化组件
3. **懒加载组件**：使用 `dynamic` 导入大型组件
4. **批量操作**：合并多个 API 调用，减少网络请求

---

**文档维护**：请在添加新功能时及时更新此文档，保持最佳实践的时效性。
```

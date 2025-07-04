import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

import MarkdownEditor from "@/components/UI/MarkdownEditor";
import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface JournalEditorProps {
  date: Date;
  onSave?: (journal: any) => void;
  onCancel?: () => void;
}

export default function JournalEditor({
  date,
  onSave,
  onCancel,
}: JournalEditorProps) {
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();
  const [content, setContent] = useState("");
  const [template, setTemplate] = useState<string | undefined>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 获取 tRPC utils 用于缓存失效
  const utils = api.useUtils();

  // 获取指定日期的日记
  const { data: existingJournal, isLoading } = api.journal.getByDate.useQuery({
    date,
  });

  // 监听日记数据变化，设置编辑器内容
  useEffect(() => {
    if (existingJournal) {
      setContent(existingJournal.content);
      setTemplate(existingJournal.template || undefined);
      setHasUnsavedChanges(false);
    } else {
      // 如果没有现有日记，清空内容
      setContent("");
      setTemplate(undefined);
      setHasUnsavedChanges(false);
    }
  }, [existingJournal]);

  // 手动保存日记
  const saveJournal = api.journal.upsert.useMutation({
    onSuccess: (data) => {
      showSuccess("日记保存成功");
      setHasUnsavedChanges(false);

      // 失效相关的查询缓存，确保其他页面能看到最新数据
      void utils.journal.getByDate.invalidate({ date });
      void utils.journal.getRecent.invalidate();
      void utils.journal.getAll.invalidate();

      onSave?.(data);
    },
    onError: (error) => {
      showError(error.message || "保存日记失败");
    },
  });

  // 自动保存日记（用于 MarkdownEditor 的自动保存功能）
  const autoSaveJournal = api.journal.upsert.useMutation({
    onSuccess: () => {
      setHasUnsavedChanges(false);
      // 自动保存成功时不显示通知，避免干扰用户

      // 失效相关的查询缓存，确保其他页面能看到最新数据
      void utils.journal.getByDate.invalidate({ date });
      void utils.journal.getRecent.invalidate();
      void utils.journal.getAll.invalidate();
    },
    onError: (error) => {
      // 自动保存失败时也不显示错误通知，避免干扰用户
      console.error("自动保存日记失败:", error);
    },
  });

  // 监听内容变化
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
  };

  // 手动保存
  const handleSave = () => {
    if (!content.trim()) {
      showError("日记内容不能为空");
      return;
    }

    saveJournal.mutate({
      date,
      content: content.trim(),
      template,
    });
  };

  // 取消编辑
  const handleCancel = async () => {
    if (hasUnsavedChanges) {
      // 使用浏览器原生的 confirm，因为这是一个简单的确认对话框
      // 而且 JournalEditor 组件通常在其他组件内部使用，不适合添加模态框
      if (window.confirm("有未保存的更改，确定要离开吗？")) {
        onCancel?.();
      }
    } else {
      onCancel?.();
    }
  };

  // 应用模板
  const applyTemplate = (templateContent: string) => {
    setContent(templateContent);
    setHasUnsavedChanges(true);
  };

  // 默认模板
  const defaultTemplate = `# ${(() => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })()} 日记

## 今日完成
- 

## 今日学习
- 

## 心得感悟
- 

## 遇到的问题
- 

## 明日计划
- `;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">加载日记中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-600">
            <CalendarIcon className="mr-1 h-4 w-4" />
            {(() => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            })()}
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center text-sm text-orange-600">
              <ClockIcon className="mr-1 h-4 w-4" />
              有未保存的更改
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* 模板按钮 */}
          {!existingJournal && content.trim() === "" && (
            <button
              onClick={() => applyTemplate(defaultTemplate)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DocumentTextIcon className="mr-1 h-4 w-4" />
              使用模板
            </button>
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={saveJournal.isPending || !content.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveJournal.isPending ? "保存中..." : "保存"}
          </button>

          {/* 取消按钮 */}
          {onCancel && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          value={content}
          onChange={handleContentChange}
          placeholder="开始写今天的日记..."
          height={400}
          preview="live"
          enableJetBrainsShortcuts={true}
          autoSave={true}
          autoSaveType="server"
          autoSaveStatus={
            autoSaveJournal.isPending
              ? "saving"
              : autoSaveJournal.isSuccess
                ? "saved"
                : "unsaved"
          }
          onAutoSave={(content) => {
            // 自动保存到服务器
            // 只检查是否有实际内容，但保留原始格式（包括换行）
            if (!content.trim()) return;

            autoSaveJournal.mutate({
              date,
              content: content, // 保留原始内容格式
              template,
            });
          }}
          className="h-full"
        />
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  EyeIcon,
  PencilIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

// 动态导入 MDEditor 以避免 SSR 问题
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false },
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  preview?: "edit" | "preview" | "live";
  className?: string;
  disabled?: boolean;
  error?: string;
  enableJetBrainsShortcuts?: boolean; // 新增：是否启用JetBrains快捷键
  autoSave?: boolean; // 新增：是否启用自动保存
  onAutoSave?: (value: string) => void; // 新增：自动保存回调
  autoSaveType?: "local" | "server"; // 新增：自动保存类型
  autoSaveStatus?: "saved" | "saving" | "unsaved"; // 新增：外部控制的保存状态
  onCtrlEnterSave?: () => void; // 新增：Ctrl+Enter 保存回调
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "开始编写你的内容...",
  height = 400,
  preview = "live",
  className = "",
  disabled = false,
  error,
  enableJetBrainsShortcuts = true,
  autoSave = false,
  onAutoSave,
  autoSaveType = "server",
  autoSaveStatus,
  onCtrlEnterSave,
}: MarkdownEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<
    "edit" | "preview" | "live"
  >(preview);
  const [lastSavedValue, setLastSavedValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 确保组件在客户端挂载后才渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听全屏状态变化，确保正确处理样式
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;

      // 如果退出全屏，确保恢复页面滚动
      if (!isFullscreen) {
        // 延迟执行，确保 MDEditor 的清理逻辑完成
        setTimeout(() => {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';

          // 移除可能的全屏相关类名
          document.body.classList.remove('w-md-editor-fullscreen');
          document.documentElement.classList.remove('w-md-editor-fullscreen');
        }, 100);
      }
    };

    if (mounted) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [mounted]);

  // 专门为 Ctrl+Enter 添加的事件监听器
  useEffect(() => {
    if (!mounted || !onCtrlEnterSave) return;

    const handleCtrlEnterKeyDown = (event: KeyboardEvent) => {
      // 检查是否是 Ctrl+Enter
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        // 检查焦点是否在当前编辑器内
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === "TEXTAREA") {
          const mdEditorContainer = activeElement.closest(".w-md-editor");
          if (mdEditorContainer) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            // 立即执行保存
            onCtrlEnterSave();
          }
        }
      }
    };

    // 使用捕获阶段监听，优先级更高
    document.addEventListener('keydown', handleCtrlEnterKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleCtrlEnterKeyDown, true);
    };
  }, [mounted, onCtrlEnterSave]);

  // 初始化lastSavedValue
  useEffect(() => {
    if (mounted) {
      setLastSavedValue(value);
      setSaveStatus("saved");
    }
  }, [mounted]); // 只在mounted变化时执行

  // 组件卸载时清理全屏相关样式
  useEffect(() => {
    return () => {
      // 确保组件卸载时恢复页面滚动
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('w-md-editor-fullscreen');
      document.documentElement.classList.remove('w-md-editor-fullscreen');
    };
  }, []);

  // 全局键盘事件监听器
  useEffect(() => {
    if (!mounted) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // 检查焦点是否在MDEditor的textarea上
      const activeElement = document.activeElement;
      if (!activeElement || activeElement.tagName !== "TEXTAREA") return;

      // 检查是否是MDEditor的textarea
      const mdEditorContainer = activeElement.closest(".w-md-editor");
      if (!mdEditorContainer) return;

      const textarea = activeElement as HTMLTextAreaElement;
      const { selectionStart, selectionEnd, value: textValue } = textarea;

      // Ctrl+Enter - 触发保存（如果提供了回调）- 始终可用
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (onCtrlEnterSave) {
          onCtrlEnterSave();
        }
        return;
      }

      // 以下快捷键需要启用 JetBrains 快捷键才生效
      if (!enableJetBrainsShortcuts) return;

      // Ctrl+Y - 删除当前行
      if (event.ctrlKey && event.key === "y") {
        event.preventDefault();

        const lines = textValue.split("\n");
        const currentLineIndex =
          textValue.substring(0, selectionStart).split("\n").length - 1;

        if (currentLineIndex >= 0 && currentLineIndex < lines.length) {
          lines.splice(currentLineIndex, 1);
          const newValue = lines.join("\n");
          onChange(newValue);

          // 设置光标位置到行首
          setTimeout(() => {
            const beforeLines = lines.slice(0, currentLineIndex);
            const newPosition =
              beforeLines.join("\n").length + (beforeLines.length > 0 ? 1 : 0);
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
          }, 0);
        }
      }

      // Ctrl+Shift+↑ - 向上移动行
      if (event.ctrlKey && event.shiftKey && event.key === "ArrowUp") {
        event.preventDefault();

        const lines = textValue.split("\n");
        const currentLineIndex =
          textValue.substring(0, selectionStart).split("\n").length - 1;

        if (currentLineIndex > 0) {
          // 交换当前行和上一行
          const currentLine = lines[currentLineIndex];
          const previousLine = lines[currentLineIndex - 1];
          if (currentLine !== undefined && previousLine !== undefined) {
            lines[currentLineIndex - 1] = currentLine;
            lines[currentLineIndex] = previousLine;
          }

          onChange(lines.join("\n"));

          // 计算新的光标位置
          setTimeout(() => {
            const beforeLines = lines.slice(0, currentLineIndex - 1);
            const currentLineStart =
              beforeLines.join("\n").length + (beforeLines.length > 0 ? 1 : 0);
            const currentLineOffset =
              selectionStart -
              (textValue.substring(0, selectionStart).lastIndexOf("\n") + 1);
            const newPosition = currentLineStart + currentLineOffset;
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
          }, 0);
        }
      }

      // Ctrl+Shift+↓ - 向下移动行
      if (event.ctrlKey && event.shiftKey && event.key === "ArrowDown") {
        event.preventDefault();

        const lines = textValue.split("\n");
        const currentLineIndex =
          textValue.substring(0, selectionStart).split("\n").length - 1;

        if (currentLineIndex < lines.length - 1) {
          // 交换当前行和下一行
          const currentLine = lines[currentLineIndex];
          const nextLine = lines[currentLineIndex + 1];
          if (currentLine !== undefined && nextLine !== undefined) {
            lines[currentLineIndex] = nextLine;
            lines[currentLineIndex + 1] = currentLine;
          }

          onChange(lines.join("\n"));

          // 计算新的光标位置
          setTimeout(() => {
            const beforeLines = lines.slice(0, currentLineIndex + 1);
            const currentLineStart =
              beforeLines.join("\n").length + (beforeLines.length > 0 ? 1 : 0);
            const currentLineOffset =
              selectionStart -
              (textValue.substring(0, selectionStart).lastIndexOf("\n") + 1);
            const newPosition = currentLineStart + currentLineOffset;
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
          }, 0);
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [mounted, enableJetBrainsShortcuts, onChange]);

  // 自动保存功能
  useEffect(() => {
    if (autoSave && onAutoSave && mounted && value !== lastSavedValue) {
      setSaveStatus("unsaved");

      // 清除之前的定时器
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // 设置新的定时器（5秒防抖，API保存需要更长间隔）
      autoSaveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("saving");
        try {
          onAutoSave(value);
          setLastSavedValue(value);

          // 对于本地保存，立即设置为已保存状态
          // 对于服务器保存，保持saving状态（由外部组件控制）
          if (autoSaveType === "local") {
            setSaveStatus("saved");
          }
        } catch (error) {
          setSaveStatus("unsaved");
        }
      }, 5000); // 改为5秒，避免频繁API调用
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [value, autoSave, onAutoSave, lastSavedValue, mounted]);

  // 处理内容变化
  const handleChange = (val?: string) => {
    onChange(val || "");
  };

  // 预览模式切换按钮
  const PreviewModeToggle = () => (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 p-1">
      <button
        type="button"
        onClick={() => setCurrentPreview("edit")}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium transition-colors ${
          currentPreview === "edit"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        title="编辑模式"
      >
        <PencilIcon className="h-4 w-4" />
        编辑
      </button>
      <button
        type="button"
        onClick={() => setCurrentPreview("live")}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium transition-colors ${
          currentPreview === "live"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        title="实时预览"
      >
        <Squares2X2Icon className="h-4 w-4" />
        实时
      </button>
      <button
        type="button"
        onClick={() => setCurrentPreview("preview")}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium transition-colors ${
          currentPreview === "preview"
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        title="预览模式"
      >
        <EyeIcon className="h-4 w-4" />
        预览
      </button>
    </div>
  );

  if (!mounted) {
    // 服务端渲染时显示简单的 textarea
    return (
      <div className={className}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            error ? "border-red-300" : ""
          }`}
          style={{ height: `${height}px` }}
          disabled={disabled}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // 处理容器级别的键盘事件
  const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+Enter - 触发保存
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (onCtrlEnterSave) {
        onCtrlEnterSave();
      }
    }
  };

  return (
    <div className={className} onKeyDown={handleContainerKeyDown}>
      <PreviewModeToggle />
      <div
        className={`overflow-hidden rounded-md border ${
          error ? "border-red-300" : "border-gray-300"
        }`}
      >
        <MDEditor
          value={value}
          onChange={handleChange}
          preview={currentPreview}
          height={height}
          data-color-mode="light"
          textareaProps={{
            placeholder,
            disabled,
            style: {
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily:
                '"SF Mono", Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace',
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
              // Ctrl+Enter - 触发保存
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                if (onCtrlEnterSave) {
                  // 使用 setTimeout 确保事件处理完成后再执行
                  setTimeout(() => {
                    onCtrlEnterSave();
                  }, 0);
                }
                return false;
              }
            },
          }}
          previewOptions={{
            style: {
              fontSize: 14,
              lineHeight: 1.6,
            },
          }}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* 快捷键提示 */}
      <div className="mt-2 space-y-1 text-xs text-gray-500">
        {/* Markdown 快捷键 */}
        <div>
          <span className="font-medium">Markdown：</span>
          <span className="ml-1">Ctrl+B 粗体</span>
          <span className="ml-2">Ctrl+I 斜体</span>
          <span className="ml-2">Ctrl+K 链接</span>
        </div>

        {/* JetBrains 快捷键 */}
        {enableJetBrainsShortcuts && (
          <div>
            <span className="font-medium">JetBrains：</span>
            <span className="ml-1">Ctrl+D 复制行</span>
            <span className="ml-2">Ctrl+Y 删除行</span>
            <span className="ml-2">Ctrl+/ 注释</span>
            <span className="ml-2">Ctrl+Shift+↑/↓ 移动行</span>
          </div>
        )}

        {/* 自动保存状态 */}
        {autoSave && (
          <div>
            <span className="font-medium">自动保存：</span>
            <span
              className={`ml-1 ${
                (autoSaveStatus || saveStatus) === "saved"
                  ? "text-green-600"
                  : (autoSaveStatus || saveStatus) === "saving"
                    ? "text-yellow-600"
                    : "text-gray-600"
              }`}
            >
              {autoSaveType === "local"
                ? (autoSaveStatus || saveStatus) === "saved"
                  ? "已保存草稿到本地"
                  : (autoSaveStatus || saveStatus) === "saving"
                    ? "保存草稿到本地中..."
                    : "未保存 (5秒后自动保存草稿)"
                : (autoSaveStatus || saveStatus) === "saved"
                  ? "已保存到服务器"
                  : (autoSaveStatus || saveStatus) === "saving"
                    ? "保存到服务器中..."
                    : "未保存 (5秒后自动保存)"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// 简化版的 Markdown 编辑器（用于较小的空间）
interface SimpleMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export function SimpleMarkdownEditor({
  value,
  onChange,
  placeholder = "支持 Markdown 格式...",
  rows = 6,
  className = "",
  disabled = false,
  error,
}: SimpleMarkdownEditorProps) {
  return (
    <div className={className}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
          error ? "border-red-300" : ""
        }`}
        disabled={disabled}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Markdown 语法提示 */}
      <div className="mt-2 text-xs text-gray-500">
        <span className="font-medium">Markdown：</span>
        <span className="ml-1">**粗体**</span>
        <span className="ml-2">*斜体*</span>
        <span className="ml-2">`代码`</span>
        <span className="ml-2">[链接](url)</span>
        <span className="ml-2"># 标题</span>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
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
}: MarkdownEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<
    "edit" | "preview" | "live"
  >(preview);

  // 确保组件在客户端挂载后才渲染
  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className={className}>
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
      <div className="mt-2 text-xs text-gray-500">
        <span className="font-medium">快捷键：</span>
        <span className="ml-1">Ctrl+B 粗体</span>
        <span className="ml-3">Ctrl+I 斜体</span>
        <span className="ml-3">Ctrl+K 链接</span>
        <span className="ml-3">Ctrl+Shift+C 代码块</span>
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

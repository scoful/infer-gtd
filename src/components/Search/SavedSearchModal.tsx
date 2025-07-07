import React, { useState, useEffect, useCallback } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface SavedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SavedSearchFormData) => void;
  initialData?: SavedSearchFormData;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export interface SavedSearchFormData {
  name: string;
  description: string;
}

export default function SavedSearchModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isLoading = false,
  mode,
}: SavedSearchModalProps) {
  const [formData, setFormData] = useState<SavedSearchFormData>({
    name: "",
    description: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        description: "",
      });
    }
  }, [initialData, isOpen]);

  // 处理提交
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onSave({
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
    });
  }, [formData, onSave]);

  // 添加 Ctrl+Enter 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        // 检查表单是否有效且不在提交中
        if (formData.name.trim() && !isLoading) {
          // 创建一个模拟的表单事件
          const mockEvent = {
            preventDefault: () => {},
          } as React.FormEvent;
          handleSubmit(mockEvent);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, formData.name, isLoading, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="bg-opacity-25 fixed inset-0 bg-black"
          onClick={onClose}
        />

        <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {mode === "create" ? "保存搜索" : "编辑搜索"}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 名称 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                搜索名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="输入搜索名称"
                required
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="输入搜索描述（可选）"
              />
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim() || isLoading}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "保存中..." : mode === "create" ? "保存" : "更新"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

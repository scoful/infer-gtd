import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { TagType } from "@prisma/client";

import { api } from "@/utils/api";
import { ButtonLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import { TagDisplay, type TagData } from "./TagDisplay";

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag?: TagData | null;
  onSuccess?: () => void;
}

interface TagFormData {
  name: string;
  color: string;
  type: TagType;
  category: string;
  description: string;
  icon: string;
}

// 预定义颜色选项
const PRESET_COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // green-500
  "#F59E0B", // orange-500
  "#EF4444", // red-500
  "#8B5CF6", // purple-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
  "#F97316", // orange-500
  "#EC4899", // pink-500
  "#6366F1", // indigo-500
  "#14B8A6", // teal-500
  "#F59E0B", // amber-500
];

// 预定义图标选项
const PRESET_ICONS = [
  "🏷️",
  "📌",
  "⭐",
  "🔥",
  "💡",
  "📝",
  "📊",
  "🎯",
  "🚀",
  "💼",
  "🏠",
  "📞",
  "💻",
  "🌐",
  "📅",
  "⏰",
  "✅",
  "❌",
  "⚠️",
  "🔔",
  "📧",
  "📁",
  "🔍",
  "⚙️",
];

export default function TagModal({
  isOpen,
  onClose,
  tag,
  onSuccess,
}: TagModalProps) {
  const [formData, setFormData] = useState<TagFormData>({
    name: "",
    color: "#3B82F6",
    type: TagType.CUSTOM,
    category: "",
    description: "",
    icon: "",
  });

  const isEditing = !!tag;
  const { showSuccess, showError } = useGlobalNotifications();

  // 当模态框打开时，根据模式初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (isEditing && tag) {
        // 编辑模式：使用标签数据填充表单
        setFormData({
          name: tag.name,
          color: tag.color || "#3B82F6",
          type: tag.type,
          category: tag.category || "",
          description: tag.description || "",
          icon: tag.icon || "",
        });
      } else {
        // 创建模式：重置表单为默认值
        resetForm();
      }
    }
  }, [isOpen, isEditing, tag]);

  // 创建标签
  const createTag = api.tag.create.useMutation({
    onSuccess: () => {
      showSuccess("标签创建成功");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(`创建标签失败: ${error.message}`);
      // 错误时不关闭Modal，让用户可以修改后重试
    },
  });

  // 更新标签
  const updateTag = api.tag.update.useMutation({
    onSuccess: () => {
      showSuccess("标签更新成功");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(`更新标签失败: ${error.message}`);
      // 错误时不关闭Modal，让用户可以修改后重试
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      color: "#3B82F6",
      type: TagType.CUSTOM,
      category: "",
      description: "",
      icon: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;

    const submitData = {
      name: formData.name.trim(),
      color: formData.color,
      type: formData.type,
      category: formData.category.trim() || undefined,
      description: formData.description.trim() || undefined,
      icon: formData.icon.trim() || undefined,
    };

    if (isEditing && tag) {
      updateTag.mutate({
        id: tag.id,
        ...submitData,
      });
    } else {
      createTag.mutate(submitData);
    }
  };

  const handleClose = () => {
    onClose();
  };

  // 预览标签
  const previewTag: TagData = {
    id: "preview",
    name: formData.name || "标签预览",
    color: formData.color,
    type: formData.type,
    category: formData.category || null,
    isSystem: false,
    description: formData.description || null,
    icon: formData.icon || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-opacity-25 fixed inset-0 bg-black" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900"
                  >
                    {isEditing ? "编辑标签" : "创建新标签"}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={handleClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 标签预览 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      预览效果
                    </label>
                    <div className="rounded-md bg-gray-50 p-3">
                      <TagDisplay
                        tag={previewTag}
                        size="md"
                        variant="default"
                        showIcon={true}
                      />
                    </div>
                  </div>

                  {/* 标签名称 */}
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      标签名称 *
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="输入标签名称..."
                    />
                  </div>

                  {/* 标签类型 */}
                  <div>
                    <label
                      htmlFor="type"
                      className="block text-sm font-medium text-gray-700"
                    >
                      标签类型
                    </label>
                    <select
                      id="type"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as TagType,
                        })
                      }
                      disabled={isEditing && tag?.isSystem}
                    >
                      <option value={TagType.CUSTOM}>自定义</option>
                      <option value={TagType.CONTEXT}>上下文</option>
                      <option value={TagType.PROJECT}>项目</option>
                      <option value={TagType.PRIORITY}>优先级</option>
                    </select>
                  </div>

                  {/* 标签分类 */}
                  <div>
                    <label
                      htmlFor="category"
                      className="block text-sm font-medium text-gray-700"
                    >
                      分类 (可选)
                    </label>
                    <input
                      type="text"
                      id="category"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="如：工作、生活、学习..."
                    />
                  </div>

                  {/* 标签颜色 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      标签颜色
                    </label>
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="h-8 w-16 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="flex-1 rounded border border-gray-300 px-3 py-1 text-sm"
                        placeholder="#3B82F6"
                      />
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`h-6 w-6 rounded border-2 ${
                            formData.color === color
                              ? "border-gray-400"
                              : "border-gray-200"
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 标签图标 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      标签图标 (可选)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      className="mb-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="输入emoji或图标..."
                    />
                    <div className="grid max-h-24 grid-cols-8 gap-1 overflow-y-auto">
                      {PRESET_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon })}
                          className={`h-8 w-8 rounded text-lg hover:bg-gray-100 ${
                            formData.icon === icon ? "bg-blue-100" : ""
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 标签描述 */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700"
                    >
                      描述 (可选)
                    </label>
                    <textarea
                      id="description"
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="输入标签描述..."
                    />
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      onClick={handleClose}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={createTag.isPending || updateTag.isPending}
                      className="flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                    >
                      {createTag.isPending || updateTag.isPending ? (
                        <ButtonLoading message="保存中..." size="sm" />
                      ) : isEditing ? (
                        "更新"
                      ) : (
                        "创建"
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

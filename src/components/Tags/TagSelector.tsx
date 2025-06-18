import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { TagType } from "@prisma/client";

import { api } from "@/utils/api";
import { TagDisplay, TagList, type TagData } from "./TagDisplay";
import { SectionLoading } from "@/components/UI";

// 标签选择器组件的属性
interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  allowCreate?: boolean;
  filterTypes?: TagType[];
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  error?: string;
}

// 标签创建表单的属性
interface TagCreateFormProps {
  onSubmit: (tagData: { name: string; type: TagType; color?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// 简单的标签创建表单
const TagCreateForm: React.FC<TagCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TagType>(TagType.CUSTOM);
  const [color, setColor] = useState("#6B7280");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({ name: name.trim(), type, color });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            标签名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入标签名称"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
            disabled={isLoading}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              类型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TagType)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value={TagType.CUSTOM}>自定义</option>
              <option value={TagType.CONTEXT}>上下文</option>
              <option value={TagType.PROJECT}>项目</option>
              <option value={TagType.PRIORITY}>优先级</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              颜色
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="block w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </form>
  );
};

// 主要的标签选择器组件
export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTagIds,
  onTagsChange,
  placeholder = "选择标签...",
  maxTags,
  allowCreate = true,
  filterTypes,
  size = "md",
  className = "",
  disabled = false,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedType, setSelectedType] = useState<TagType | "ALL">("ALL");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取标签列表
  const { data: tagsData, isLoading } = api.tag.getAll.useQuery(
    {
      limit: 100,
      search: searchQuery || undefined,
      type: selectedType !== "ALL" ? selectedType : undefined,
    },
    { enabled: !disabled }
  );

  // 创建标签的mutation
  const createTagMutation = api.tag.create.useMutation({
    onSuccess: (newTag) => {
      // 添加新创建的标签到选中列表
      onTagsChange([...selectedTagIds, newTag.id]);
      setShowCreateForm(false);
      setSearchQuery("");
    },
  });

  // 获取可用的标签列表
  const availableTags = useMemo(() => {
    if (!tagsData?.tags) return [];
    
    let tags = tagsData.tags;
    
    // 按类型筛选
    if (filterTypes && filterTypes.length > 0) {
      tags = tags.filter(tag => filterTypes.includes(tag.type));
    }
    
    return tags;
  }, [tagsData?.tags, filterTypes]);

  // 获取已选中的标签
  const selectedTags = useMemo(() => {
    return availableTags.filter(tag => selectedTagIds.includes(tag.id));
  }, [availableTags, selectedTagIds]);

  // 获取未选中的标签（用于下拉列表）
  const unselectedTags = useMemo(() => {
    return availableTags.filter(tag => !selectedTagIds.includes(tag.id));
  }, [availableTags, selectedTagIds]);

  // 处理标签选择
  const handleTagSelect = (tag: TagData) => {
    if (selectedTagIds.includes(tag.id)) {
      // 取消选择
      onTagsChange(selectedTagIds.filter(id => id !== tag.id));
    } else {
      // 选择标签
      if (maxTags && selectedTagIds.length >= maxTags) {
        return; // 达到最大数量限制
      }
      onTagsChange([...selectedTagIds, tag.id]);
    }
  };

  // 处理标签移除
  const handleTagRemove = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  // 处理创建新标签
  const handleCreateTag = (tagData: { name: string; type: TagType; color?: string }) => {
    createTagMutation.mutate(tagData);
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 获取尺寸相关的样式
  const sizeClasses = {
    sm: "text-sm",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 主输入区域 */}
      <div
        className={`
          relative border rounded-md bg-white transition-colors
          ${disabled ? "bg-gray-50 cursor-not-allowed" : "cursor-text"}
          ${error ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-500" : "border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500"}
          ${isOpen ? "ring-1" : ""}
          ${sizeClasses[size]}
        `}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-1 p-2 min-h-[2.5rem]">
          {/* 已选中的标签 */}
          {selectedTags.length > 0 && (
            <TagList
              tags={selectedTags}
              size="sm"
              showRemove={!disabled}
              onRemove={handleTagRemove}
            />
          )}
          
          {/* 输入框 */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedTags.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] outline-none bg-transparent"
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
          />
          
          {/* 下拉箭头 */}
          <ChevronDownIcon
            className={`h-4 w-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* 下拉选项 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* 搜索和筛选 */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索标签..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* 类型筛选 */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as TagType | "ALL")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">所有类型</option>
              <option value={TagType.CONTEXT}>上下文</option>
              <option value={TagType.PROJECT}>项目</option>
              <option value={TagType.PRIORITY}>优先级</option>
              <option value={TagType.CUSTOM}>自定义</option>
            </select>
          </div>

          {/* 标签列表 */}
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-4">
                <SectionLoading />
              </div>
            ) : unselectedTags.length > 0 ? (
              <div className="p-2">
                {unselectedTags.map((tag) => (
                  <div
                    key={tag.id}
                    onClick={() => handleTagSelect(tag)}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                  >
                    <TagDisplay
                      tag={tag}
                      size="sm"
                      clickable={false}
                    />
                    {maxTags && selectedTagIds.length >= maxTags && (
                      <span className="text-xs text-gray-400">已达上限</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? "未找到匹配的标签" : "暂无可用标签"}
              </div>
            )}
          </div>

          {/* 创建新标签 */}
          {allowCreate && !showCreateForm && searchQuery && (
            <div className="border-t border-gray-200">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full p-3 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                创建标签 "{searchQuery}"
              </button>
            </div>
          )}

          {/* 创建标签表单 */}
          {showCreateForm && (
            <TagCreateForm
              onSubmit={handleCreateTag}
              onCancel={() => setShowCreateForm(false)}
              isLoading={createTagMutation.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;

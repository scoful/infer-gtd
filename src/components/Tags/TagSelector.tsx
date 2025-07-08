import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { TagType } from "@prisma/client";

import { api } from "@/utils/api";
import { TagDisplay, TagList, type TagData } from "./TagDisplay";
import { SectionLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

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
  gridLayout?: boolean; // 是否使用网格布局
  closeOnSelect?: boolean; // 选择标签后是否关闭下拉菜单
  sortable?: boolean; // 是否支持拖拽排序已选中的标签
}

// 标签创建表单的属性
interface TagCreateFormProps {
  onSubmit: (tagData: { name: string; type: TagType; color?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialName?: string;
}

// 简单的标签创建表单
const TagCreateForm: React.FC<TagCreateFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  initialName = "",
}) => {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<TagType>(TagType.CUSTOM);
  const [color, setColor] = useState("#6B7280");

  // 当initialName改变时更新name状态
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit({ name: name.trim(), type, color });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            标签名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入标签名称"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            autoFocus
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              类型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TagType)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              <option value={TagType.CUSTOM}>自定义</option>
              <option value={TagType.CONTEXT}>上下文</option>
              <option value={TagType.PROJECT}>项目</option>
              <option value={TagType.PRIORITY}>优先级</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              颜色
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="block h-10 w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            className="rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
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
  gridLayout = true, // 默认启用网格布局
  closeOnSelect = false, // 默认不自动关闭
  sortable = false, // 默认不启用拖拽排序
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedType, setSelectedType] = useState<TagType | "ALL">("ALL");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
    "bottom",
  );
  const [isPositionCalculated, setIsPositionCalculated] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 通知系统
  const { showSuccess, showError } = useGlobalNotifications();

  // 获取标签列表
  const { data: tagsData, isLoading } = api.tag.getAll.useQuery(
    {
      limit: 100,
      search: searchQuery || undefined,
      type: selectedType !== "ALL" ? selectedType : undefined,
    },
    { enabled: !disabled },
  );

  // 创建标签的mutation
  const createTagMutation = api.tag.create.useMutation({
    onSuccess: (newTag) => {
      showSuccess("标签创建成功");
      // 添加新创建的标签到选中列表
      onTagsChange([...selectedTagIds, newTag.id]);
      setShowCreateForm(false);
      setSearchQuery("");
      // 重新计算位置，因为创建表单消失了
      if (isOpen) {
        const position = calculateDropdownPosition();
        setDropdownPosition(position);
      }
    },
    onError: (error) => {
      showError(`创建标签失败: ${error.message}`);
      // 错误时不关闭创建表单，让用户可以修改后重试
    },
  });

  // 获取可用的标签列表
  const availableTags = useMemo(() => {
    if (!tagsData?.tags) return [];

    let tags = tagsData.tags;

    // 按类型筛选
    if (filterTypes && filterTypes.length > 0) {
      tags = tags.filter((tag) => filterTypes.includes(tag.type));
    }

    return tags;
  }, [tagsData?.tags, filterTypes]);

  // 获取已选中的标签（按选择顺序排列）
  const selectedTags = useMemo(() => {
    // 按照 selectedTagIds 的顺序来排列标签，保持用户选择的顺序
    return selectedTagIds
      .map((id) => availableTags.find((tag) => tag.id === id))
      .filter(Boolean) as TagData[];
  }, [availableTags, selectedTagIds]);

  // 获取未选中的标签（用于下拉列表）
  const unselectedTags = useMemo(() => {
    return availableTags.filter((tag) => !selectedTagIds.includes(tag.id));
  }, [availableTags, selectedTagIds]);

  // 处理标签选择
  const handleTagSelect = (tag: TagData) => {
    if (selectedTagIds.includes(tag.id)) {
      // 取消选择
      onTagsChange(selectedTagIds.filter((id) => id !== tag.id));
    } else {
      // 选择标签
      if (maxTags && selectedTagIds.length >= maxTags) {
        return; // 达到最大数量限制
      }
      onTagsChange([...selectedTagIds, tag.id]);
      // 选择标签后清空搜索文字
      setSearchQuery("");
      // 如果设置了自动关闭，则关闭下拉菜单
      if (closeOnSelect) {
        closeDropdown();
      }
    }
  };

  // 处理标签移除
  const handleTagRemove = (tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId));
  };

  // 处理标签重新排序
  const handleTagReorder = (newOrder: string[]) => {
    onTagsChange(newOrder);
  };

  // 处理创建新标签
  const handleCreateTag = (tagData: {
    name: string;
    type: TagType;
    color?: string;
  }) => {
    createTagMutation.mutate(tagData);
  };

  // 计算下拉菜单最佳位置
  const calculateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return "bottom";

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 简化的Dialog检测：检查是否在模态框中
    // 如果TagSelector距离视口底部的空间很少，很可能在Dialog中
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // 基础高度：搜索区域(约100px) + 标签列表(150-250px) + 创建表单(如果显示)
    const searchAreaHeight = 100;
    const tagListHeight = showCreateForm ? 120 : 200;
    const createFormHeight = showCreateForm ? 180 : 0;
    const totalDropdownHeight =
      searchAreaHeight + tagListHeight + createFormHeight;

    // 如果下方空间不足300px，很可能在Dialog中，优先向上弹出
    if (spaceBelow < 300) {
      return "top";
    }

    // 否则使用标准逻辑
    if (
      spaceBelow < totalDropdownHeight &&
      spaceAbove > Math.max(spaceBelow, 200)
    ) {
      return "top";
    } else {
      return "bottom";
    }
  }, [showCreateForm]);

  // 关闭下拉菜单的函数
  const closeDropdown = () => {
    setIsOpen(false);
    setShowCreateForm(false);
    setIsPositionCalculated(false);
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 打开下拉菜单的函数
  const openDropdown = () => {
    if (!containerRef.current) return;

    // 先计算位置
    const position = calculateDropdownPosition();
    setDropdownPosition(position);
    setIsPositionCalculated(true);

    // 然后打开下拉菜单
    setIsOpen(true);
  };

  // 当创建表单显示状态变化时重新计算位置
  useEffect(() => {
    if (isOpen) {
      const position = calculateDropdownPosition();
      setDropdownPosition(position);
    }
  }, [showCreateForm, isOpen, calculateDropdownPosition]);

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
        className={`relative rounded-md border bg-white transition-colors ${disabled ? "cursor-not-allowed bg-gray-50" : "cursor-text"} ${error ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-500" : "border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500"} ${isOpen ? "ring-1" : ""} ${sizeClasses[size]} `}
        onClick={() => {
          if (!disabled) {
            openDropdown();
            inputRef.current?.focus();
          }
        }}
      >
        <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1 p-2">
          {/* 已选中的标签 */}
          {selectedTags.length > 0 && (
            <TagList
              tags={selectedTags}
              size="sm"
              showRemove={!disabled}
              onRemove={handleTagRemove}
              sortable={sortable}
              onReorder={handleTagReorder}
            />
          )}

          {/* 输入框 */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedTags.length === 0 ? placeholder : ""}
            className="min-w-[120px] flex-1 bg-transparent outline-none"
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onFocus={() => {
              if (!isOpen) {
                openDropdown();
              }
            }}
            onKeyDown={(e) => {
              // 支持键盘导航
              if (e.key === "Enter" && !isOpen) {
                e.preventDefault();
                openDropdown();
              } else if (e.key === "Escape" && isOpen) {
                e.preventDefault();
                closeDropdown();
              }
            }}
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
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* 下拉选项 */}
      {isOpen && !disabled && isPositionCalculated && (
        <div
          ref={dropdownRef}
          className={`absolute z-[60] w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl ${dropdownPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"} `}
          style={{
            maxHeight: (() => {
              if (!containerRef.current) return "650px";

              const rect = containerRef.current.getBoundingClientRect();
              const viewportHeight = window.innerHeight;

              if (dropdownPosition === "top") {
                // 向上弹出时，使用可用的上方空间
                const availableSpace = rect.top - 20; // 留20px边距
                // 如果显示创建表单，需要更多空间
                const minHeight = showCreateForm ? 550 : 450;
                return `${Math.min(650, Math.max(minHeight, availableSpace))}px`;
              } else {
                // 向下弹出时，使用可用的下方空间
                const availableSpace = viewportHeight - rect.bottom - 20; // 留20px边距
                // 如果显示创建表单，需要更多空间
                const minHeight = showCreateForm ? 500 : 400;
                return `${Math.min(650, Math.max(minHeight, availableSpace))}px`;
              }
            })(),
          }}
        >
          {/* 搜索和筛选 */}
          <div className="border-b border-gray-200 p-3">
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索标签..."
                className="w-full rounded-md border border-gray-300 py-2 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* 类型筛选 */}
            <select
              value={selectedType}
              onChange={(e) =>
                setSelectedType(e.target.value as TagType | "ALL")
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">所有类型</option>
              <option value={TagType.CONTEXT}>上下文</option>
              <option value={TagType.PROJECT}>项目</option>
              <option value={TagType.PRIORITY}>优先级</option>
              <option value={TagType.CUSTOM}>自定义</option>
            </select>
          </div>

          {/* 标签列表 */}
          <div
            className="flex-1 overflow-y-auto"
            style={{
              maxHeight: showCreateForm ? "220px" : "450px",
            }}
          >
            {isLoading ? (
              <div className="p-4">
                <SectionLoading />
              </div>
            ) : unselectedTags.length > 0 ? (
              <div className="px-3 pt-2 pb-6">
                {gridLayout ? (
                  // 网格布局
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
                    }}
                  >
                    {unselectedTags.map((tag) => (
                      <div
                        key={tag.id}
                        onClick={() => handleTagSelect(tag)}
                        className={`flex cursor-pointer items-center justify-center rounded-lg border border-gray-200 p-3 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none active:scale-95 active:bg-blue-100 ${maxTags && selectedTagIds.length >= maxTags ? "cursor-not-allowed opacity-50 hover:bg-transparent hover:shadow-none" : ""} `}
                        style={{ alignItems: "center", minHeight: "42px" }}
                        title={
                          maxTags && selectedTagIds.length >= maxTags
                            ? "已达到最大标签数量限制"
                            : `点击选择 ${tag.name}`
                        }
                        tabIndex={
                          maxTags && selectedTagIds.length >= maxTags ? -1 : 0
                        }
                        role="button"
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            !(maxTags && selectedTagIds.length >= maxTags)
                          ) {
                            e.preventDefault();
                            handleTagSelect(tag);
                          }
                        }}
                      >
                        <TagDisplay
                          tag={tag}
                          size="sm"
                          clickable={false}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // 列表布局（原始布局）
                  <div className="space-y-1">
                    {unselectedTags.map((tag) => (
                      <div
                        key={tag.id}
                        onClick={() => handleTagSelect(tag)}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-transparent p-3 transition-colors hover:border-blue-200 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
                        style={{ alignItems: "center" }}
                        tabIndex={
                          maxTags && selectedTagIds.length >= maxTags ? -1 : 0
                        }
                        role="button"
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            !(maxTags && selectedTagIds.length >= maxTags)
                          ) {
                            e.preventDefault();
                            handleTagSelect(tag);
                          }
                        }}
                      >
                        <TagDisplay
                          tag={tag}
                          size="sm"
                          clickable={false}
                          className="min-w-0 flex-1"
                        />
                        {maxTags && selectedTagIds.length >= maxTags && (
                          <span className="ml-2 flex-shrink-0 text-xs text-gray-400">
                            已达上限
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                {searchQuery ? "未找到匹配的标签" : "暂无可用标签"}
              </div>
            )}
          </div>

          {/* 创建新标签 */}
          {allowCreate && !showCreateForm && searchQuery && (
            <div className="border-t border-gray-200">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-center p-3 text-left text-sm text-blue-600 hover:bg-blue-50"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                创建标签 &ldquo;{searchQuery}&rdquo;
              </button>
            </div>
          )}

          {/* 创建标签表单 */}
          {showCreateForm && (
            <div className="max-h-40 overflow-y-auto border-t border-gray-200">
              <TagCreateForm
                onSubmit={handleCreateTag}
                onCancel={() => setShowCreateForm(false)}
                isLoading={createTagMutation.isPending}
                initialName={searchQuery.trim()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;

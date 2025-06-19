import React from "react";
import { TagIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { TagType } from "@prisma/client";

// 标签数据类型
export interface TagData {
  id: string;
  name: string;
  color?: string | null;
  type: TagType;
  category?: string | null;
  isSystem: boolean;
  description?: string | null;
  icon?: string | null;
}

// 标签显示组件的属性
interface TagDisplayProps {
  tag: TagData;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "minimal";
  showIcon?: boolean;
  showRemove?: boolean;
  onRemove?: (tagId: string) => void;
  className?: string;
  clickable?: boolean;
  onClick?: (tag: TagData) => void;
}

// 标签列表显示组件的属性
interface TagListProps {
  tags: TagData[];
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "minimal";
  showIcon?: boolean;
  showRemove?: boolean;
  onRemove?: (tagId: string) => void;
  className?: string;
  maxDisplay?: number;
  clickable?: boolean;
  onTagClick?: (tag: TagData) => void;
}

// 获取标签类型的默认颜色
function getDefaultTagColor(type: TagType): string {
  const defaultColors = {
    [TagType.CONTEXT]: "#3B82F6", // blue-500
    [TagType.PROJECT]: "#8B5CF6", // purple-500
    [TagType.PRIORITY]: "#EF4444", // red-500
    [TagType.CUSTOM]: "#6B7280", // gray-500
  };
  return defaultColors[type];
}

// 获取标签类型的标签
function getTagTypeLabel(type: TagType): string {
  const labels = {
    [TagType.CONTEXT]: "上下文",
    [TagType.PROJECT]: "项目",
    [TagType.PRIORITY]: "优先级",
    [TagType.CUSTOM]: "自定义",
  };
  return labels[type];
}

// 获取尺寸相关的样式类
function getSizeClasses(size: "sm" | "md" | "lg") {
  const sizeClasses = {
    sm: {
      container: "px-2 py-1 text-xs",
      icon: "h-3 w-3",
      iconContainer: "w-3 h-3 text-xs leading-none",
      removeButton: "h-3 w-3 ml-1",
    },
    md: {
      container: "px-3 py-1.5 text-sm",
      icon: "h-4 w-4",
      iconContainer: "w-4 h-4 text-sm leading-none",
      removeButton: "h-4 w-4 ml-1.5",
    },
    lg: {
      container: "px-4 py-2 text-base",
      icon: "h-5 w-5",
      iconContainer: "w-5 h-5 text-base leading-none",
      removeButton: "h-5 w-5 ml-2",
    },
  };
  return sizeClasses[size];
}

// 获取变体相关的样式类
function getVariantClasses(variant: "default" | "outline" | "minimal", color: string) {
  const baseColor = color || "#6B7280";
  
  switch (variant) {
    case "outline":
      return {
        container: "border-2 bg-white text-gray-700",
        style: { borderColor: baseColor },
      };
    case "minimal":
      return {
        container: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        style: {},
      };
    default: // "default"
      return {
        container: "text-white",
        style: { backgroundColor: baseColor },
      };
  }
}

// 单个标签显示组件
export const TagDisplay: React.FC<TagDisplayProps> = ({
  tag,
  size = "md",
  variant = "default",
  showIcon = true,
  showRemove = false,
  onRemove,
  className = "",
  clickable = false,
  onClick,
}) => {
  const sizeClasses = getSizeClasses(size);
  const color = tag.color || getDefaultTagColor(tag.type);
  const variantClasses = getVariantClasses(variant, color);

  const handleClick = () => {
    if (clickable && onClick) {
      onClick(tag);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(tag.id);
    }
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium transition-colors
        ${sizeClasses.container}
        ${variantClasses.container}
        ${clickable ? "cursor-pointer hover:opacity-80" : ""}
        ${className}
      `}
      style={{
        ...variantClasses.style,
        alignItems: 'center',
        lineHeight: 1
      }}
      onClick={handleClick}
      title={tag.description || `${getTagTypeLabel(tag.type)}标签: ${tag.name}`}
    >
      {/* 图标 */}
      {showIcon && (
        <>
          {tag.icon ? (
            <span
              className={`
                inline-flex items-center justify-center flex-shrink-0
                ${size === 'sm' ? 'mr-1' : size === 'md' ? 'mr-1.5' : 'mr-2'}
                ${sizeClasses.iconContainer}
              `}
              style={{ lineHeight: 1 }}
            >
              {tag.icon}
            </span>
          ) : (
            <TagIcon className={`flex-shrink-0 ${size === 'sm' ? 'mr-1' : size === 'md' ? 'mr-1.5' : 'mr-2'} ${sizeClasses.icon}`} />
          )}
        </>
      )}
      
      {/* 标签名称 */}
      <span className="truncate leading-none flex items-center">{tag.name}</span>
      
      {/* 系统标签标识 */}
      {tag.isSystem && size !== "sm" && (
        <span className="ml-1 text-xs opacity-75">*</span>
      )}
      
      {/* 删除按钮 */}
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className={`
            hover:bg-black hover:bg-opacity-20 rounded-full p-0.5 transition-colors
            ${sizeClasses.removeButton}
          `}
          title="移除标签"
        >
          <XMarkIcon className="h-full w-full" />
        </button>
      )}
    </span>
  );
};

// 标签列表显示组件
export const TagList: React.FC<TagListProps> = ({
  tags,
  size = "md",
  variant = "default",
  showIcon = true,
  showRemove = false,
  onRemove,
  className = "",
  maxDisplay,
  clickable = false,
  onTagClick,
}) => {
  const displayTags = maxDisplay ? tags.slice(0, maxDisplay) : tags;
  const remainingCount = maxDisplay && tags.length > maxDisplay ? tags.length - maxDisplay : 0;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayTags.map((tag) => (
        <TagDisplay
          key={tag.id}
          tag={tag}
          size={size}
          variant={variant}
          showIcon={showIcon}
          showRemove={showRemove}
          onRemove={onRemove}
          clickable={clickable}
          onClick={onTagClick}
        />
      ))}
      
      {/* 显示剩余标签数量 */}
      {remainingCount > 0 && (
        <span
          className={`
            inline-flex items-center rounded-full bg-gray-200 text-gray-600 font-medium
            ${getSizeClasses(size).container}
          `}
          title={`还有 ${remainingCount} 个标签`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

// 按类型分组显示标签
interface TagGroupDisplayProps {
  tags: TagData[];
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "minimal";
  showIcon?: boolean;
  showRemove?: boolean;
  onRemove?: (tagId: string) => void;
  className?: string;
  clickable?: boolean;
  onTagClick?: (tag: TagData) => void;
}

export const TagGroupDisplay: React.FC<TagGroupDisplayProps> = ({
  tags,
  size = "md",
  variant = "default",
  showIcon = true,
  showRemove = false,
  onRemove,
  className = "",
  clickable = false,
  onTagClick,
}) => {
  // 按类型分组
  const groupedTags = tags.reduce((groups, tag) => {
    const type = tag.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(tag);
    return groups;
  }, {} as Record<TagType, TagData[]>);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Object.entries(groupedTags).map(([type, typeTags]) => (
        <div key={type}>
          <div className="text-xs font-medium text-gray-500 mb-1">
            {getTagTypeLabel(type as TagType)}
          </div>
          <TagList
            tags={typeTags}
            size={size}
            variant={variant}
            showIcon={showIcon}
            showRemove={showRemove}
            onRemove={onRemove}
            clickable={clickable}
            onTagClick={onTagClick}
          />
        </div>
      ))}
    </div>
  );
};

export default TagDisplay;

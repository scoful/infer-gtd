import React, { useState, useEffect } from "react";
import { type TOCItem } from "@/hooks/useTOC";

interface TOCProps {
  items: TOCItem[];
  className?: string;
}

export default function TOC({ items, className = "" }: TOCProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // 监听滚动，自动高亮当前项
  useEffect(() => {
    const handleScroll = () => {
      // 获取所有 TOC 对应的元素
      const elements = items.map((item) => ({
        id: item.id,
        element: document.getElementById(item.id),
      }));

      // 找到当前可见的元素
      let currentId: string | null = null;
      for (const { id, element } of elements) {
        if (element) {
          const rect = element.getBoundingClientRect();
          // 如果元素在视口上半部分，认为是当前项
          if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
            currentId = id;
            break;
          }
        }
      }

      // 如果没有找到，使用第一个可见的元素
      if (!currentId) {
        for (const { id, element } of elements) {
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              currentId = id;
              break;
            }
          }
        }
      }

      setActiveId(currentId);
    };

    // 初始化
    handleScroll();

    // 监听滚动
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);

    if (element) {
      // 查找最近的 LI 元素
      const li = element.closest("li");
      const targetElement = li || element;

      // 直接计算目标位置并滚动
      const targetRect = targetElement.getBoundingClientRect();
      const targetTop = targetRect.top + window.pageYOffset;
      const scrollTarget = targetTop - 80; // 留出 80px 顶部空间

      window.scrollTo({
        top: scrollTarget,
        behavior: "smooth",
      });

      setActiveId(id);
    }
  };

  // 双击标题区域，滚动到顶部
  const handleTitleDoubleClick = () => {
    // 1. 右边内容区域滚动到顶部
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    // 2. 目录列表本身也滚动到顶部
    const tocListContainer = document.querySelector(".toc-list-container");
    if (tocListContainer) {
      tocListContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }

    setActiveId(null); // 清除高亮
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`sticky top-20 h-[calc(100vh-6rem)] ${className}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* 固定标题 */}
        <div
          className="flex flex-shrink-0 cursor-pointer items-center border-b border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
          onDoubleClick={handleTitleDoubleClick}
          title="双击回到顶部"
        >
          <svg
            className="mr-2 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">目录</h3>
        </div>

        {/* 可滚动列表 */}
        <div className="toc-list-container flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  paddingLeft: item.level
                    ? `${(item.level - 1) * 12}px`
                    : "0px",
                }}
              >
                <button
                  onClick={() => handleClick(item.id)}
                  className={`w-full text-left text-sm transition-all duration-200 ${
                    activeId === item.id
                      ? "font-medium text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title={item.text}
                >
                  <span className="block truncate">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

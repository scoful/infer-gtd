import React, { useEffect, useRef, useState } from 'react';

interface ResponsiveTextProps {
  text: string;
  className?: string;
  minLines?: number;
  maxLines?: number;
  showTooltip?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
}

/**
 * 响应式文字显示组件
 * 根据容器大小和屏幕尺寸动态调整显示行数
 */
export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  text,
  className = '',
  minLines = 2,
  maxLines = 4,
  showTooltip = true,
  as: Component = 'div',
}) => {
  const textRef = useRef<HTMLElement>(null);
  const [lineClamp, setLineClamp] = useState(minLines);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const updateLineClamp = () => {
      if (!textRef.current) return;

      const element = textRef.current;
      const containerWidth = element.offsetWidth;
      const containerHeight = element.offsetHeight;
      
      // 根据屏幕尺寸和容器大小计算合适的行数
      let calculatedLines = minLines;
      
      // 屏幕尺寸判断
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      if (screenWidth >= 1536) {
        // 2xl屏幕：更多行数
        calculatedLines = Math.min(maxLines, minLines + 2);
      } else if (screenWidth >= 1280) {
        // xl屏幕：适中行数
        calculatedLines = Math.min(maxLines, minLines + 1);
      } else if (screenWidth >= 1024) {
        // lg屏幕：标准行数
        calculatedLines = Math.min(maxLines, minLines + 1);
      } else if (screenWidth >= 768) {
        // md屏幕：减少行数
        calculatedLines = minLines;
      } else {
        // sm屏幕：最少行数
        calculatedLines = Math.max(1, minLines - 1);
      }

      // 容器高度调整
      if (containerHeight > 200) {
        calculatedLines = Math.min(maxLines, calculatedLines + 1);
      } else if (containerHeight < 100) {
        calculatedLines = Math.max(1, calculatedLines - 1);
      }

      setLineClamp(calculatedLines);

      // 检查文字是否溢出
      const tempElement = element.cloneNode(true) as HTMLElement;
      tempElement.style.webkitLineClamp = 'unset';
      tempElement.style.display = 'block';
      tempElement.style.visibility = 'hidden';
      tempElement.style.position = 'absolute';
      tempElement.style.top = '-9999px';
      tempElement.style.maxHeight = 'none';
      tempElement.style.overflow = 'visible';
      
      document.body.appendChild(tempElement);
      const fullHeight = tempElement.scrollHeight;
      document.body.removeChild(tempElement);

      // 计算当前行数对应的高度
      const lineHeight = parseInt(getComputedStyle(element).lineHeight) || 20;
      const currentMaxHeight = lineHeight * calculatedLines;
      
      setIsOverflowing(fullHeight > currentMaxHeight);
    };

    // 初始计算
    updateLineClamp();

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(updateLineClamp);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    window.addEventListener('resize', updateLineClamp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateLineClamp);
    };
  }, [text, minLines, maxLines]);

  const dynamicClassName = `
    ${className}
    overflow-hidden
    ${lineClamp === 1 ? 'line-clamp-1' : ''}
    ${lineClamp === 2 ? 'line-clamp-2' : ''}
    ${lineClamp === 3 ? 'line-clamp-3' : ''}
    ${lineClamp === 4 ? 'line-clamp-4' : ''}
    ${lineClamp === 5 ? 'line-clamp-5' : ''}
    ${lineClamp === 6 ? 'line-clamp-6' : ''}
  `.trim();

  const props = {
    ref: textRef,
    className: dynamicClassName,
    ...(showTooltip && isOverflowing ? { title: text } : {}),
  };

  return React.createElement(Component, props, text);
};

export default ResponsiveText;

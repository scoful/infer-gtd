import { useState, useEffect } from "react";

export interface TOCItem {
  text: string;
  id: string;
  lineIndex: number; // 原始行号，用于精确定位
  level?: number; // 标题级别（1-6），用于多级缩进显示
}

/**
 * 从 Markdown 内容中智能提取 TOC
 * 优先级：标题 > 列表
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
export function useTOC(markdown: string): TOCItem[] {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  useEffect(() => {
    const items = extractTOC(markdown);
    setTocItems(items);
  }, [markdown]);

  return tocItems;
}

/**
 * 智能提取 TOC：优先使用标题，降级使用列表
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
function extractTOC(markdown: string): TOCItem[] {
  if (!markdown) return [];

  // 1. 先尝试提取标题
  const headings = extractHeadings(markdown);
  if (headings.length > 0) {
    return headings;
  }

  // 2. 没有标题，降级使用列表
  return extractLists(markdown);
}

/**
 * 从 Markdown 中提取标题（# 标题）
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
function extractHeadings(markdown: string): TOCItem[] {
  if (!markdown) return [];

  // 1. 移除代码块（避免误匹配）
  let cleanedMarkdown = markdown;
  cleanedMarkdown = cleanedMarkdown.replace(/```[\s\S]*?```/g, "");
  cleanedMarkdown = cleanedMarkdown.replace(/`[^`]+`/g, "");

  // 2. 提取标题（# 到 ###### ）
  const lines = cleanedMarkdown.split("\n");
  const tocItems: TOCItem[] = [];
  let tocIndex = 0;

  lines.forEach((line, lineIndex) => {
    // 匹配标题：^#{1,6}\s+(.+)$
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match?.[1] && match[2]) {
      const level = match[1].length; // 标题级别（1-6）
      const text = match[2].trim();
      if (!text) return; // 跳过空标题

      const id = `toc-item-${tocIndex}`;
      tocItems.push({ text, id, lineIndex, level });
      tocIndex++;
    }
  });

  return tocItems;
}

/**
 * 从 Markdown 中提取一级列表项
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
function extractLists(markdown: string): TOCItem[] {
  if (!markdown) return [];

  // 1. 移除代码块（避免误匹配）
  let cleanedMarkdown = markdown;

  // 移除代码块（```...```）
  cleanedMarkdown = cleanedMarkdown.replace(/```[\s\S]*?```/g, "");

  // 移除行内代码（`...`）
  cleanedMarkdown = cleanedMarkdown.replace(/`[^`]+`/g, "");

  // 2. 仅提取“顶层无序列表项”（排除任务列表项）
  const lines = cleanedMarkdown.split("\n");
  const tocItems: TOCItem[] = [];
  let tocIndex = 0;

  lines.forEach((line, lineIndex) => {
    // 仅匹配顶级（行首无缩进）的无序列表
    // 排除任务列表：- [ ] / - [x]
    const match = /^[-*]\s+(?!\[[ xX]\]\s)(.+)$/.exec(line);
    if (match?.[1]) {
      const text = match[1].trim();
      if (!text) return; // 跳过空列表项

      const id = `toc-item-${tocIndex}`; // 与渲染时的ID生成规则保持一致
      tocItems.push({ text, id, lineIndex });
      tocIndex++;
    }
  });

  return tocItems;
}

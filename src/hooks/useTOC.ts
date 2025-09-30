import { useState, useEffect } from 'react';

export interface TOCItem {
  text: string;
  id: string;
  lineIndex: number; // 原始行号，用于精确定位
}

/**
 * 从 Markdown 内容中提取一级列表项生成 TOC
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
export function useTOC(markdown: string): TOCItem[] {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);

  useEffect(() => {
    const items = extractTOCFromLists(markdown);
    setTocItems(items);
  }, [markdown]);

  return tocItems;
}

/**
 * 从 Markdown 中提取一级列表项
 * @param markdown Markdown 内容
 * @returns TOC 项数组
 */
function extractTOCFromLists(markdown: string): TOCItem[] {
  if (!markdown) return [];

  // 1. 移除代码块（避免误匹配）
  let cleanedMarkdown = markdown;
  
  // 移除代码块（```...```）
  cleanedMarkdown = cleanedMarkdown.replace(/```[\s\S]*?```/g, '');
  
  // 移除行内代码（`...`）
  cleanedMarkdown = cleanedMarkdown.replace(/`[^`]+`/g, '');

  // 2. 仅提取“顶层无序列表项”（排除任务列表项）
  const lines = cleanedMarkdown.split('\n');
  const tocItems: TOCItem[] = [];
  let tocIndex = 0;

  lines.forEach((line, lineIndex) => {
    // 仅匹配顶级（行首无缩进）的无序列表
    // 排除任务列表：- [ ] / - [x]
    const match = line.match(/^[-*]\s+(?!\[[ xX]\]\s)(.+)$/);
    if (match) {
      const text = match[1].trim();
      if (!text) return; // 跳过空列表项

      const id = `toc-item-${tocIndex}`; // 与渲染时的ID生成规则保持一致
      tocItems.push({ text, id, lineIndex });
      tocIndex++;
    }
  });

  return tocItems;
}


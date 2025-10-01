import React, { useEffect, useRef, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { LoadingSpinner, LoadingText } from "./Loading";

interface ToastUIEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  placeholder?: string;
  className?: string;
  mode?: "markdown" | "wysiwyg";
  enableJetBrainsShortcuts?: boolean;
  onCtrlEnterSave?: (currentContent?: string) => void;
  // 自动保存功能
  autoSave?: boolean;
  onAutoSave?: (value: string) => void;
  autoSaveType?: "local" | "server";
  autoSaveStatus?: "saved" | "saving" | "unsaved";
  // 预览模式
  preview?: "edit" | "preview" | "live";
}

export default function ToastUIEditor({
  value,
  onChange,
  height = "500px",
  placeholder = "开始编写你的内容...",
  className = "",
  mode = "markdown",
  enableJetBrainsShortcuts = true,
  onCtrlEnterSave,
  autoSave = false,
  onAutoSave,
  autoSaveType = "server",
  autoSaveStatus,
  preview = "live",
}: ToastUIEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [Editor, setEditor] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewStyle] = useState<"vertical" | "tab">("vertical");
  const [hideSwitch] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [showFormatConfirm, setShowFormatConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [suppressInitialLeak] = useState(true);
  const firstChangeRef = useRef<string | null>(null);

  // 自动保存相关
  const [lastSavedValue, setLastSavedValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 自动保存功能
  useEffect(() => {
    if (autoSave && onAutoSave && mounted && value !== lastSavedValue) {
      setSaveStatus("unsaved");

      // 清除之前的定时器
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // 设置新的定时器（5秒防抖）
      autoSaveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("saving");
        try {
          onAutoSave(value);
          setLastSavedValue(value);

          // 对于本地保存，立即设置为已保存状态
          if (autoSaveType === "local") {
            setSaveStatus("saved");
          }
        } catch (error) {
          setSaveStatus("unsaved");
        }
      }, 5000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, [value, autoSave, onAutoSave, lastSavedValue, mounted, autoSaveType]);

  // 全屏切换函数（使用函数式更新避免闭包问题）
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // 格式化中英文空格的函数
  const formatChineseEnglish = (markdown: string): string => {
    // 保护代码块和特殊语法
    const protectedBlocks: string[] = [];
    let text = markdown;

    // 1. 保护代码块（```...```）
    text = text.replace(/```[\s\S]*?```/g, (match) => {
      protectedBlocks.push(match);
      return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
    });

    // 2. 保护行内代码（`...`）
    text = text.replace(/`[^`]+`/g, (match) => {
      protectedBlocks.push(match);
      return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
    });

    // 3. 保护链接（[text](url)）
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
      protectedBlocks.push(match);
      return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
    });

    // 4. 保护图片（![alt](url)）
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match) => {
      protectedBlocks.push(match);
      return `__PROTECTED_BLOCK_${protectedBlocks.length - 1}__`;
    });

    // 5. 格式化：中文 + 英文/数字（避免重复添加空格）
    text = text.replace(
      /([\u4e00-\u9fa5])([a-zA-Z0-9@&=\[\$\%\^])/g,
      (match, p1, p2) => {
        // 检查是否已经有空格
        return p1 + " " + p2;
      },
    );

    // 6. 格式化：英文/数字 + 中文（避免重复添加空格）
    text = text.replace(
      /([a-zA-Z0-9!&;=\]\,\.\:\?\$\%\^])([\u4e00-\u9fa5])/g,
      (match, p1, p2) => {
        return p1 + " " + p2;
      },
    );

    // 7. 清理多余空格（只清理行中间的多余空格，保留换行符和行首缩进）
    // 逐行处理，保护行首空格（用于列表缩进等）
    text = text
      .split("\n")
      .map((line) => {
        // 提取行首空格
        const leadingSpaces = /^[ \t]*/.exec(line)?.[0] || "";
        // 提取行尾内容
        const content = line.slice(leadingSpaces.length);
        // 只清理内容中的多余空格（不包括换行符）
        const cleanedContent = content.replace(/[^\S\r\n]{2,}/g, " ");
        // 重新组合
        return leadingSpaces + cleanedContent;
      })
      .join("\n");

    // 8. 恢复保护的块
    protectedBlocks.forEach((block, index) => {
      text = text.replace(`__PROTECTED_BLOCK_${index}__`, block);
    });

    // 9. 确保行内代码前后有空格（排除标点符号和行首行尾）
    // 定义中英文标点符号（使用模板字符串避免引号冲突）
    const punctuation = `，。！？；：、""''（）《》【】,\\.!?;:"\\'\\(\\)\\[\\]<>`;

    // 前面没有空格、换行符、标点符号时添加空格
    text = text.replace(
      new RegExp(`([^\\s\\n${punctuation}])(\`[^\`]+\`)`, "g"),
      "$1 $2",
    );

    // 后面没有空格、换行符、标点符号时添加空格
    text = text.replace(
      new RegExp(`(\`[^\`]+\`)([^\\s\\n${punctuation}])`, "g"),
      "$1 $2",
    );

    return text;
  };

  // 格式化按钮点击处理
  const handleFormat = async () => {
    if (!editorRef.current || isFormatting) return;
    setShowFormatConfirm(true);
  };

  // 确认格式化
  const handleConfirmFormat = async () => {
    setShowFormatConfirm(false);
    setIsFormatting(true);

    // 使用 setTimeout 让 React 有机会渲染 Loading
    setTimeout(async () => {
      const startTime = Date.now();

      try {
        const editor = editorRef.current.getInstance();
        const currentContent = editor.getMarkdown();
        const formattedContent = formatChineseEnglish(currentContent);

        // 只有内容发生变化时才更新
        if (currentContent !== formattedContent) {
          editor.setMarkdown(formattedContent);
          onChange(formattedContent);
        }
      } catch (error) {
        console.error("格式化失败:", error);
      }

      // 确保 Loading 至少显示 500ms
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 500;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        setIsFormatting(false);
      }, remainingTime);
    }, 100);
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev); // 切换全屏状态
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      } else if (e.ctrlKey && e.shiftKey && e.key === "F") {
        // Ctrl+Shift+F 格式化快捷键
        e.preventDefault();
        void handleFormat();
      } else if (e.ctrlKey && e.key === "h") {
        // Ctrl+H 高亮快捷键
        e.preventDefault();
        handleHighlight();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, isFormatting]);

  // 编辑器加载完成后添加全屏按钮和内容清理（仅初始化时）
  useEffect(() => {
    if (!Editor || !mounted) return;

    // 等待编辑器完全渲染（仅初始化时需要延迟）
    const timer = setTimeout(() => {
      addFullscreenButtonToEditor();

      // 检查并清理可能的初始内容泄露
      if (editorRef.current) {
        const currentContent = editorRef.current.getInstance().getMarkdown();

        const suspiciousPatterns = [
          "Write",
          "Preview",
          "Markdown",
          "WYSIWYG",
          "Toast UI：",
          "JetBrains：",
        ];
        const lines = currentContent
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean);

        // 检测是否包含可疑的UI文本（只要包含就清理，不需要全部匹配）
        const containsSuspiciousContent = lines.some((line: string) =>
          suspiciousPatterns.some((pattern) => line.includes(pattern)),
        );

        // 如果内容看起来像是UI泄露（包含多个可疑模式或者内容很短但包含UI文本）
        const looksLikeUILeak =
          containsSuspiciousContent &&
          (currentContent.length < 200 || // 短内容更可能是UI泄露
            lines.filter((line: string) =>
              suspiciousPatterns.some((pattern) => line.includes(pattern)),
            ).length >= 2); // 包含多个可疑模式

        if (looksLikeUILeak) {
          editorRef.current.getInstance().setMarkdown(value || "");
          // 强制触发onChange来更新状态
          setTimeout(() => {
            if (editorRef.current) {
              onChange(editorRef.current.getInstance().getMarkdown());
            }
          }, 100);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [Editor, mounted, value]); // 添加 value 依赖

  // 全屏状态变化时立即更新按钮样式（无延迟）
  useEffect(() => {
    if (!Editor || !mounted) return;

    // 直接更新已存在的按钮，无需延迟
    updateFullscreenButtonState();
  }, [isFullscreen]); // 仅监听 isFullscreen 变化

  // 格式化状态变化时更新按钮样式
  useEffect(() => {
    if (!Editor || !mounted) return;

    updateFormatButtonState();
  }, [isFormatting]); // 监听 isFormatting 变化

  // 更新已存在的全屏按钮状态（立即更新，无延迟）
  const updateFullscreenButtonState = () => {
    const existingButton =
      containerRef.current?.querySelector(".fullscreen-btn");
    if (existingButton) {
      // 更新按钮图标和标签
      existingButton.innerHTML = isFullscreen ? "🗗" : "🗖";
      existingButton.setAttribute(
        "aria-label",
        isFullscreen ? "退出全屏 (F11/Esc)" : "全屏 (F11)",
      );
      existingButton.setAttribute(
        "title",
        isFullscreen ? "退出全屏 (F11/Esc)" : "全屏 (F11)",
      );
    }
  };

  // 更新已存在的格式化按钮状态
  const updateFormatButtonState = () => {
    const existingButton = containerRef.current?.querySelector(".format-btn");
    if (existingButton) {
      existingButton.innerHTML = isFormatting ? "⏳" : "✨";
      (existingButton as HTMLButtonElement).disabled = isFormatting;
      (existingButton as HTMLElement).style.opacity = isFormatting
        ? "0.5"
        : "1";
      (existingButton as HTMLElement).style.cursor = isFormatting
        ? "wait"
        : "pointer";
    }
  };

  // 高亮按钮点击处理
  const handleHighlight = () => {
    if (!editorRef.current) return;

    try {
      const editor = editorRef.current.getInstance();
      const selection = editor.getSelection();

      // 获取完整的 Markdown 源码
      const markdown = editor.getMarkdown();

      // 获取实际选中的文本（渲染后的纯文本）
      const selectedText = editor.getSelectedText();

      if (!selectedText) return;

      // 检查是否在 Markdown 模式
      if (Array.isArray(selection) && selection.length === 2) {
        // Markdown 模式：selection = [[startLine, startCh], [endLine, endCh]]
        const [start, end] = selection;
        const [startLine, startCh] = start;
        const [endLine, endCh] = end;

        const lines = markdown.split('\n');

        // 单行选中
        if (startLine === endLine) {
          const line = lines[startLine - 1] || '';

          // 查找 <mark> 标签的位置
          const markStartIndex = line.lastIndexOf('<mark>', startCh - 1);
          const markEndIndex = line.indexOf('</mark>', endCh - 1);

          // 检查选中文本是否被 <mark> 标签包围
          // Toast UI Editor 的选区索引可能有偏移，需要容错检查（允许±1的偏差）
          const hasMarkBefore = markStartIndex !== -1 && Math.abs((markStartIndex + 6) - startCh) <= 1;
          const hasMarkAfter = markEndIndex !== -1 && Math.abs(markEndIndex - endCh) <= 1;

          if (hasMarkBefore && hasMarkAfter) {
            // 已高亮，取消高亮：扩展选区删除标签
            // Toast UI Editor 使用 1-based 索引，JavaScript 使用 0-based 索引
            // 需要将 JavaScript 的索引转换为 Toast UI 的索引（+1）
            const newStart: [number, number] = [startLine, markStartIndex + 1];
            const newEnd: [number, number] = [endLine, markEndIndex + 7 + 1];

            editor.setSelection(newStart, newEnd);
            editor.replaceSelection(selectedText);
          } else {
            // 未高亮，添加高亮
            editor.replaceSelection(`<mark>${selectedText}</mark>`);
          }
        } else {
          // 多行选中：简化处理，直接添加高亮
          editor.replaceSelection(`<mark>${selectedText}</mark>`);
        }
      } else {
        // WYSIWYG 模式：直接添加高亮
        editor.replaceSelection(`<mark>${selectedText}</mark>`);
      }
    } catch (error) {
      console.error("高亮失败:", error);
    }
  };

  // 添加全屏按钮和格式化按钮到编辑器的函数
  const addFullscreenButtonToEditor = () => {
    // 查找最后一个可见的工具栏组
    const allToolbarGroups = containerRef.current?.querySelectorAll(
      ".toastui-editor-toolbar .toastui-editor-toolbar-group",
    );

    let lastVisibleToolbar = null;
    allToolbarGroups?.forEach((group) => {
      const style = window.getComputedStyle(group);
      if (style.display !== "none") {
        lastVisibleToolbar = group;
      }
    });

    if (lastVisibleToolbar) {
      addHighlightButton(lastVisibleToolbar);
      addFormatButton(lastVisibleToolbar);
      addFullscreenButton(lastVisibleToolbar);
    }
  };

  // 添加高亮按钮的函数
  const addHighlightButton = (toolbar: Element) => {
    // 移除已存在的高亮按钮
    const existingButton = toolbar.querySelector(".highlight-btn");
    if (existingButton) {
      existingButton.remove();
    }

    // 创建新的高亮按钮
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toastui-editor-toolbar-icons highlight-btn";
    button.setAttribute("aria-label", "高亮文本 (Ctrl+H)");
    button.setAttribute("title", "高亮文本 (Ctrl+H)");
    button.style.cssText = `
      background-image: none !important;
      margin: 7px 5px !important;
      padding: 0px !important;
      border: none !important;
      width: 24px !important;
      height: 24px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      cursor: pointer !important;
      border-radius: 4px !important;
      transition: all 0.2s ease !important;
    `;
    button.innerHTML = "🖍️";
    button.addEventListener("click", handleHighlight);

    // 添加hover效果
    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "#f3f4f6 !important";
    });
    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "transparent !important";
    });

    toolbar.appendChild(button);
  };

  // 添加格式化按钮的函数
  const addFormatButton = (toolbar: Element) => {
    // 移除已存在的格式化按钮
    const existingButton = toolbar.querySelector(".format-btn");
    if (existingButton) {
      existingButton.remove();
    }

    // 创建新的格式化按钮
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toastui-editor-toolbar-icons format-btn";
    button.setAttribute("aria-label", "格式化中英文空格 (Ctrl+Shift+F)");
    button.setAttribute("title", "格式化中英文空格 (Ctrl+Shift+F)");
    button.style.cssText = `
      background-image: none !important;
      margin: 7px 5px !important;
      padding: 0px !important;
      border: none !important;
      border-radius: 3px !important;
      background: transparent !important;
      cursor: pointer !important;
      font-size: 14px !important;
      line-height: 25.5px !important;
      display: inline-block !important;
      text-align: center !important;
      vertical-align: baseline !important;
      width: 32px !important;
      height: 32px !important;
      box-sizing: border-box !important;
      color: #374151 !important;
      transition: all 0.2s ease !important;
      ${isFormatting ? "opacity: 0.5 !important; cursor: wait !important;" : ""}
    `;
    button.innerHTML = isFormatting ? "⏳" : "✨";
    button.disabled = isFormatting;
    button.addEventListener("click", () => void handleFormat());

    // 添加hover效果
    button.addEventListener("mouseenter", () => {
      if (!isFormatting) {
        button.style.backgroundColor = "#f3f4f6 !important";
        button.style.borderRadius = "4px !important";
      }
    });
    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "transparent !important";
      button.style.borderRadius = "3px !important";
    });

    // 直接添加到传入的工具栏（应该是工具栏组）
    toolbar.appendChild(button);
  };

  // 添加全屏按钮的函数
  const addFullscreenButton = (toolbar: Element) => {
    // 移除已存在的全屏按钮
    const existingButton = toolbar.querySelector(".fullscreen-btn");
    if (existingButton) {
      existingButton.remove();
    }

    // 创建新的全屏按钮
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toastui-editor-toolbar-icons fullscreen-btn";
    button.setAttribute(
      "aria-label",
      isFullscreen ? "退出全屏 (F11/Esc)" : "全屏 (F11)",
    );
    button.setAttribute(
      "title",
      isFullscreen ? "退出全屏 (F11/Esc)" : "全屏 (F11)",
    );
    button.style.cssText = `
      background-image: none !important;
      margin: 7px 5px !important;
      padding: 0px !important;
      border: none !important;
      border-radius: 3px !important;
      background: transparent !important;
      cursor: pointer !important;
      font-size: 14px !important;
      line-height: 25.5px !important;
      display: inline-block !important;
      text-align: center !important;
      vertical-align: baseline !important;
      width: 32px !important;
      height: 32px !important;
      box-sizing: border-box !important;
      color: #374151 !important;
      transition: all 0.2s ease !important;
    `;
    button.innerHTML = isFullscreen ? "🗗" : "🗖";
    button.addEventListener("click", toggleFullscreen);

    // 添加hover效果
    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "#f3f4f6 !important";
      button.style.borderRadius = "4px !important";
    });
    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "transparent !important";
      button.style.borderRadius = "3px !important";
    });

    // 直接添加到传入的工具栏（应该是工具栏组）
    toolbar.appendChild(button);
  };

  useEffect(() => {
    if (!mounted) return;

    // 动态导入Toast UI Editor
    const loadEditor = async () => {
      try {
        // （样式已在 _app.tsx 全局引入，这里不再动态导入）

        // 导入编辑器
        const { Editor: ToastEditor } = await import("@toast-ui/react-editor");
        setEditor(() => ToastEditor);
      } catch (error) {
        console.error("Failed to load Toast UI Editor:", error);
      }
    };

    void loadEditor();
  }, [mounted]);

  useEffect(() => {
    if (
      editorRef.current &&
      value !== editorRef.current.getInstance().getMarkdown()
    ) {
      // 延迟设置内容，确保编辑器完全初始化
      setTimeout(() => {
        if (editorRef.current) {
          const currentContent = editorRef.current.getInstance().getMarkdown();
          // 只有当前内容不是期望值时才更新
          if (currentContent !== value) {
            editorRef.current.getInstance().setMarkdown(value || "");
          }
        }
      }, 50);
    }
  }, [value]);

  // JetBrains快捷键实现
  useEffect(() => {
    if (!mounted || !Editor || !enableJetBrainsShortcuts) {
      return;
    }

    // 等待编辑器完全初始化
    const timer = setTimeout(() => {
      if (!editorRef.current) {
        return;
      }

      // 获取编辑器实例（以便快捷键操作），当前未直接使用
      // const editor = editorRef.current.getInstance();

      // 在document级别监听键盘事件
      const handleKeyDown = (event: KeyboardEvent) => {
        // 只处理我们关心的快捷键，避免处理修饰键本身
        if (
          !event.ctrlKey ||
          ["Control", "Shift", "Alt", "Meta"].includes(event.key)
        ) {
          return;
        }

        // 检查是否在Toast UI Editor中
        const target = event.target as HTMLElement;
        const isInEditor =
          target.closest(".toastui-editor") ||
          target.closest(".toastui-editor-md-container") ||
          target.closest(".toastui-editor-defaultUI") ||
          target.classList.contains("ProseMirror") ||
          (target.tagName === "TEXTAREA" &&
            target.closest('[data-testid="toastui-editor"]')) ||
          (target.tagName === "TEXTAREA" &&
            containerRef.current?.contains(target));

        if (!isInEditor) {
          console.log("Event ignored - not in Toast UI Editor");
          return;
        }

        // 获取编辑器实例来操作内容
        // 使用当前的editorRef，避免闭包问题
        const currentEditorRef = editorRef.current;
        if (!currentEditorRef) {
          console.log("No editor ref available");
          return;
        }

        const editorInstance = currentEditorRef.getInstance();
        if (!editorInstance) {
          console.log(
            "No editor instance - editorRef.current:",
            !!currentEditorRef,
          );
          return;
        }

        // Ctrl+Enter - 保存
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          // 强力阻断其他监听器，防止重复触发
          try {
            (event as any).stopImmediatePropagation?.();
          } catch {}

          if (onCtrlEnterSave) {
            // 获取当前编辑器内容并传递给回调
            const currentContent = editorInstance.getMarkdown();
            onCtrlEnterSave(currentContent);
          }
          return;
        }

        // Ctrl+D - 复制当前行或重复选区（JetBrains风格）
        if (event.ctrlKey && event.key === "d") {
          event.preventDefault();
          event.stopPropagation();
          // 强力阻断其他监听器（如底层编辑器默认处理或旧的CodeMirror分支）
          try {
            (event as any).stopImmediatePropagation?.();
          } catch {}

          try {
            const selection = editorInstance.getSelection();
            const [start, end] = selection;

            // 仅在 Markdown 模式（[line, ch]）下处理；WYSIWYG 为 number 偏移，暂不支持
            if (!Array.isArray(start) || !Array.isArray(end)) {
              console.log("Ctrl+D currently supports Markdown mode only");
              return;
            }

            const md = editorInstance.getMarkdown();
            const lines = md.split("\n");
            const lineNum = Math.max(1, Math.min(start[0], lines.length));
            const currentLineText = (lines[lineNum - 1] ?? "").replace(
              /\r/g,
              "",
            );

            // 强制移动到行末+1的虚拟位置，确保插入位置正确
            const endPosition = currentLineText.length + 1;
            editorInstance.setSelection(
              [lineNum, endPosition],
              [lineNum, endPosition],
            );

            // 在精确位置插入内容
            editorInstance.replaceSelection(`\n${currentLineText}`);

            // 立即将光标移动到新行开头
            editorInstance.setSelection([lineNum + 1, 0], [lineNum + 1, 0]);
          } catch (error) {
            console.log("Ctrl+D failed:", error);
          }
          return;
        }

        // Ctrl+Y - 删除当前行
        if (event.ctrlKey && event.key === "y") {
          event.preventDefault();
          event.stopPropagation();

          try {
            const selection = editorInstance.getSelection();
            const [start, end] = selection;

            // 仅在 Markdown 模式下处理
            if (!Array.isArray(start) || !Array.isArray(end)) {
              console.log("Ctrl+Y currently supports Markdown mode only");
              return;
            }

            const md = editorInstance.getMarkdown();
            const lines = md.split("\n");
            const lineNum = Math.max(1, Math.min(start[0], lines.length));
            const currentLineText = lines[lineNum - 1] || "";

            // 使用replaceSelection精确删除，避免setMarkdown的滚动问题
            if (lines.length === 1) {
              // 唯一行，清空所有内容
              editorInstance.setSelection([1, 0], [1, currentLineText.length]);
              editorInstance.replaceSelection("");
            } else if (lineNum === lines.length) {
              // 最后一行，从上一行的换行符开始删除
              const prevLineLength = lines[lineNum - 2]?.length || 0;
              editorInstance.setSelection(
                [lineNum - 1, prevLineLength],
                [lineNum, currentLineText.length],
              );
              editorInstance.replaceSelection("");
              // 光标定位到上一行末尾
              editorInstance.setSelection(
                [lineNum - 1, prevLineLength],
                [lineNum - 1, prevLineLength],
              );
            } else {
              // 普通行，从行开头到下一行开头（包括换行符）
              editorInstance.setSelection([lineNum, 0], [lineNum + 1, 0]);
              editorInstance.replaceSelection("");
              // 光标定位到当前行开头
              editorInstance.setSelection([lineNum, 0], [lineNum, 0]);
            }
          } catch (error) {
            console.log("Ctrl+Y failed:", error);
          }
          return;
        }

        // Ctrl+Shift+↑ - 向上移动当前行（内存替换方案 - 已保存）
        if (event.ctrlKey && event.shiftKey && event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          // 强力阻断其他监听器
          try {
            (event as any).stopImmediatePropagation?.();
          } catch {}

          try {
            const selection = editorInstance.getSelection();
            const [start, end] = selection;

            // 仅在 Markdown 模式下处理
            if (!Array.isArray(start) || !Array.isArray(end)) {
              console.log("Ctrl+Shift+↑ currently supports Markdown mode only");
              return;
            }

            const md = editorInstance.getMarkdown();
            const lines = md.split("\n");
            const lineNum = Math.max(1, Math.min(start[0], lines.length));

            // 边界检查：第一行不能向上移动
            if (lineNum <= 1) {
              return;
            }

            const currentLineText = (lines[lineNum - 1] ?? "").replace(
              /\r/g,
              "",
            );
            const prevLineText = (lines[lineNum - 2] ?? "").replace(/\r/g, "");
            const originalCursorPos = start[1];

            // 精确替换方案：与 Ctrl+Alt+U 一致
            const endCh = currentLineText.length + 1;
            editorInstance.setSelection([lineNum - 1, 0], [lineNum, endCh]);
            editorInstance.replaceSelection(
              `${currentLineText}\n${prevLineText}`,
            );

            // 强制刷新预览并复位光标
            setTimeout(() => {
              const currentMarkdown = editorInstance.getMarkdown();
              onChange(currentMarkdown);

              const newCursorPos = Math.min(
                originalCursorPos,
                currentLineText.length,
              );
              editorInstance.setSelection(
                [lineNum - 1, newCursorPos],
                [lineNum - 1, newCursorPos],
              );
            }, 50);
          } catch (error) {
            console.log("Ctrl+Shift+↑ failed:", error);
          }
          return;
        }

        // Ctrl+Shift+↓ - 向下移动当前行（内存替换方案 - 已保存）
        if (event.ctrlKey && event.shiftKey && event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          // 强力阻断其他监听器
          try {
            (event as any).stopImmediatePropagation?.();
          } catch {}

          try {
            const selection = editorInstance.getSelection();
            const [start, end] = selection;

            // 仅在 Markdown 模式下处理
            if (!Array.isArray(start) || !Array.isArray(end)) {
              console.log("Ctrl+Shift+↓ currently supports Markdown mode only");
              return;
            }

            const md = editorInstance.getMarkdown();
            const lines = md.split("\n");
            const lineNum = Math.max(1, Math.min(start[0], lines.length));

            // 边界检查：最后一行不能向下移动
            if (lineNum >= lines.length) {
              return;
            }

            const currentLineText = (lines[lineNum - 1] ?? "").replace(
              /\r/g,
              "",
            );
            const nextLineText = (lines[lineNum] ?? "").replace(/\r/g, "");
            const originalCursorPos = start[1];

            // 精确替换方案：与 Ctrl+Alt+J 一致
            const endChDown = nextLineText.length + 1;
            editorInstance.setSelection([lineNum, 0], [lineNum + 1, endChDown]);
            editorInstance.replaceSelection(
              `${nextLineText}\n${currentLineText}`,
            );

            // 强制刷新预览并复位光标
            setTimeout(() => {
              const currentMarkdown = editorInstance.getMarkdown();
              onChange(currentMarkdown);

              const newCursorPos = Math.min(
                originalCursorPos,
                currentLineText.length,
              );
              editorInstance.setSelection(
                [lineNum + 1, newCursorPos],
                [lineNum + 1, newCursorPos],
              );
            }, 50);
          } catch (error) {
            console.log("Ctrl+Shift+↓ failed:", error);
          }
          return;
        }
      };

      // 在document级别监听，使用捕获阶段确保优先执行
      console.log("Adding document keydown listener for JetBrains shortcuts");
      document.addEventListener("keydown", handleKeyDown, true);

      return () => {
        console.log(
          "Removing document keydown listener for JetBrains shortcuts",
        );
        document.removeEventListener("keydown", handleKeyDown, true);
      };
    }, 1000); // 等待1秒让编辑器完全初始化
    return () => {
      clearTimeout(timer);
    };
  }, [mounted, enableJetBrainsShortcuts, onCtrlEnterSave, Editor]); // 添加Editor依赖

  const handleChange = () => {
    if (editorRef.current) {
      const markdown = editorRef.current.getInstance().getMarkdown();

      // 首次 onChange 监测：检测并阻止UI元素文本泄露
      if (firstChangeRef.current === null) {
        firstChangeRef.current = markdown;

        // 扩展的泄露内容检测 - 只检测明确的UI元素文本，不包含placeholder
        const lines = markdown
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const suspiciousPatterns = ["Write", "Preview", "Markdown", "WYSIWYG"];

        // 检测是否包含可疑的UI文本（只要包含就是泄露）
        const looksLikeLeak =
          lines.length > 0 &&
          lines.some((line: string) =>
            suspiciousPatterns.some((pattern) => line.includes(pattern)),
          );

        if (looksLikeLeak && suppressInitialLeak) {
          // 清空编辑器内容并重新设置
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.getInstance().setMarkdown("");
            }
          }, 100);
          return;
        }
      }

      // 防抖处理，避免频繁调用 onChange
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }

      changeTimeoutRef.current = setTimeout(() => {
        onChange(markdown);
      }, 50); // 50ms 防抖
    }
  };

  if (!mounted || !Editor) {
    return (
      <div className={`rounded-md border border-gray-300 ${className}`}>
        <div
          className="flex items-center justify-center bg-gray-50 text-gray-500"
          style={{ height }}
        >
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p>加载Toast UI Editor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${className} ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}
      style={isFullscreen ? { height: "100vh" } : {}}
    >
      {/* 自动保存状态显示 */}
      {autoSave && (
        <div className="mb-2 text-xs text-gray-500">
          <span
            className={`${
              (autoSaveStatus || saveStatus) === "saved"
                ? "text-green-600"
                : (autoSaveStatus || saveStatus) === "saving"
                  ? "text-yellow-600"
                  : "text-gray-600"
            }`}
          >
            {autoSaveType === "local"
              ? (autoSaveStatus || saveStatus) === "saved"
                ? "已保存草稿到本地"
                : (autoSaveStatus || saveStatus) === "saving"
                  ? "保存草稿到本地中..."
                  : "未保存 (5秒后自动保存草稿)"
              : (autoSaveStatus || saveStatus) === "saved"
                ? "已保存到服务器"
                : (autoSaveStatus || saveStatus) === "saving"
                  ? "保存到服务器中..."
                  : "未保存 (5秒后自动保存)"}
          </span>
        </div>
      )}

      <Editor
        ref={editorRef}
        initialValue={value || ""}
        placeholder={placeholder}
        height={isFullscreen ? "100vh" : height}
        initialEditType={mode}
        key="toast-ui-editor-stable"
        previewStyle={previewStyle}
        useCommandShortcut={true}
        usageStatistics={false}
        hideModeSwitch={hideSwitch}
        toolbarItems={[
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task", "indent", "outdent"],
          ["table", "image", "link"],
          ["code", "codeblock"],
          ["scrollSync"],
        ]}
        onChange={handleChange}
        hooks={{
          addImageBlobHook: (
            blob: Blob,
            callback: (url: string, altText: string) => void,
          ) => {
            // 简单的图片处理，实际项目中应该上传到服务器
            const url = URL.createObjectURL(blob);
            callback(url, "image");
          },
        }}
      />

      {/* 格式化 Loading 遮罩 */}
      {isFormatting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-8 shadow-xl">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="xl" />
              <LoadingText size="lg">正在格式化内容...</LoadingText>
            </div>
          </div>
        </div>
      )}

      {/* 格式化确认模态框 */}
      <ConfirmModal
        isOpen={showFormatConfirm}
        onClose={() => setShowFormatConfirm(false)}
        onConfirm={handleConfirmFormat}
        title="格式化内容"
        message="确定要格式化内容吗？&#10;&#10;将自动在中英文字符之间添加空格。&#10;（可以使用 Ctrl+Z 撤销）"
        confirmText="确认格式化"
        cancelText="取消"
        type="info"
        isLoading={isFormatting}
      />

      {/* 快捷键说明面板 */}
      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowShortcuts(!showShortcuts);
          }}
          className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <span>⌨️ 快捷键说明</span>
          <span className="text-gray-500">
            {showShortcuts ? '▲' : '▼'}
          </span>
        </button>

        {showShortcuts && (
          <div className="border-t border-gray-200 px-4 py-3 text-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* 编辑器功能 */}
              <div>
                <h4 className="mb-2 font-semibold text-gray-900">编辑器功能</h4>
                <ul className="space-y-1 text-gray-600">
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">F11</kbd> 全屏/退出全屏</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Esc</kbd> 退出全屏</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Shift+F</kbd> 格式化中英文空格</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+H</kbd> 高亮文本</li>
                </ul>
              </div>

              {/* JetBrains 风格 */}
              {enableJetBrainsShortcuts && (
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900">JetBrains 风格</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Enter</kbd> 保存</li>
                    <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+D</kbd> 复制当前行</li>
                    <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Y</kbd> 删除当前行</li>
                    <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Shift+↑</kbd> 向上移动行</li>
                    <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Shift+↓</kbd> 向下移动行</li>
                  </ul>
                </div>
              )}

              {/* Toast UI 内置 */}
              <div>
                <h4 className="mb-2 font-semibold text-gray-900">Toast UI 内置</h4>
                <ul className="space-y-1 text-gray-600">
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+B</kbd> 粗体</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+I</kbd> 斜体</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Z</kbd> 撤销</li>
                  <li><kbd className="rounded bg-gray-200 px-1.5 py-0.5">Ctrl+Shift+Z</kbd> 重做</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Toast UI Viewer组件用于预览
export function ToastUIViewer({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const viewerRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [Viewer, setViewer] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const loadViewer = async () => {
      try {
        // （样式已在 _app.tsx 全局引入，这里不再动态导入）

        // 导入查看器
        const { Viewer: ToastViewer } = await import("@toast-ui/react-editor");
        setViewer(() => ToastViewer);
      } catch (error) {
        console.error("Failed to load Toast UI Viewer:", error);
      }
    };

    void loadViewer();
  }, [mounted]);

  if (!mounted || !Viewer) {
    return (
      <div className={`rounded-md border border-gray-300 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="mb-2 h-4 w-3/4 rounded bg-gray-200"></div>
          <div className="mb-2 h-4 w-1/2 rounded bg-gray-200"></div>
          <div className="h-4 w-5/6 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-gray-300 ${className}`}>
      <div className="p-4">
        <Viewer ref={viewerRef} initialValue={content} />
      </div>
    </div>
  );
}

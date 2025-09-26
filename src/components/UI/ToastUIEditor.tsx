import React, { useEffect, useRef, useState } from "react";

interface ToastUIEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  placeholder?: string;
  className?: string;
  mode?: "markdown" | "wysiwyg";
  enableJetBrainsShortcuts?: boolean;
  onCtrlEnterSave?: () => void;
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
  const [mounted, setMounted] = useState(false);
  const [Editor, setEditor] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewStyle] = useState<"vertical" | "tab">("vertical");
  const [hideSwitch] = useState(false);

  const [suppressInitialLeak] = useState(true);
  const firstChangeRef = useRef<string | null>(null);

  // 自动保存相关
  const [lastSavedValue, setLastSavedValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
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
    };
  }, [value, autoSave, onAutoSave, lastSavedValue, mounted, autoSaveType]);

  // 全屏切换函数（使用函数式更新避免闭包问题）
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
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
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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
          "Write", "Preview", "Markdown", "WYSIWYG",
          "Toast UI：", "JetBrains："
        ];
        const lines = currentContent.split("\n").map((s: string) => s.trim()).filter(Boolean);

        // 检测是否包含可疑的UI文本（只要包含就清理，不需要全部匹配）
        const containsSuspiciousContent = lines.some((line: string) =>
          suspiciousPatterns.some(pattern => line.includes(pattern))
        );

        // 如果内容看起来像是UI泄露（包含多个可疑模式或者内容很短但包含UI文本）
        const looksLikeUILeak = containsSuspiciousContent && (
          currentContent.length < 200 || // 短内容更可能是UI泄露
          lines.filter(line => suspiciousPatterns.some(pattern => line.includes(pattern))).length >= 2 // 包含多个可疑模式
        );

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

  // 更新已存在的全屏按钮状态（立即更新，无延迟）
  const updateFullscreenButtonState = () => {
    const existingButton = containerRef.current?.querySelector(
      ".fullscreen-btn",
    ) as HTMLButtonElement;
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

  // 添加全屏按钮到编辑器的函数
  const addFullscreenButtonToEditor = () => {
    // 查找最后一个可见的工具栏组
    const allToolbarGroups = containerRef.current?.querySelectorAll(
      ".toastui-editor-toolbar .toastui-editor-toolbar-group",
    );

    let lastVisibleToolbar = null;
    allToolbarGroups?.forEach((group) => {
      const style = window.getComputedStyle(group as Element);
      if (style.display !== "none") {
        lastVisibleToolbar = group;
      }
    });

    if (lastVisibleToolbar) {
      addFullscreenButton(lastVisibleToolbar);
    }
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

    loadEditor();
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
          if (onCtrlEnterSave) {
            onCtrlEnterSave();
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
            const [start, end] = selection as any;

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
            const [start, end] = selection as any;

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
            const [start, end] = selection as any;

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
            const [start, end] = selection as any;

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
        const lines = markdown.split("\n").map((s: string) => s.trim()).filter(Boolean);
        const suspiciousPatterns = [
          "Write", "Preview", "Markdown", "WYSIWYG"
        ];

        // 检测是否包含可疑的UI文本（只要包含就是泄露）
        const looksLikeLeak = lines.length > 0 && lines.some((line: string) =>
          suspiciousPatterns.some(pattern => line.includes(pattern))
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

      onChange(markdown);
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

    loadViewer();
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

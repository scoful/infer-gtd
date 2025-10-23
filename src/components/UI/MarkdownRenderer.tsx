import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";

const ListDepthContext = React.createContext(0);

// 无序列表组件
function UnorderedList({ children, ...props }: React.ComponentProps<"ul">) {
  const depth = React.useContext(ListDepthContext);
  return (
    <ListDepthContext.Provider value={depth + 1}>
      <ul className="mb-4 ml-4 space-y-2" {...props}>
        {children}
      </ul>
    </ListDepthContext.Provider>
  );
}

// 有序列表组件
function OrderedList({ children, ...props }: React.ComponentProps<"ol">) {
  const depth = React.useContext(ListDepthContext);
  return (
    <ListDepthContext.Provider value={depth + 1}>
      <ol className="mb-4 ml-4 space-y-2" {...props}>
        {children}
      </ol>
    </ListDepthContext.Provider>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const handleInlineCodeCopy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    } catch {
      // 降级处理：使用传统方法
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    }
  };

  // 为一级列表项添加 HTML 锚点
  const processedContent = React.useMemo(() => {
    if (!content) return "";

    const lines = content.split("\n");
    let tocIndex = 0;
    let inCodeBlock = false;

    const processedLines = lines.map((line) => {
      // 检查是否进入/退出代码块
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return line;
      }

      // 如果在代码块中，不处理
      if (inCodeBlock) {
        return line;
      }

      // 优先匹配标题（# 标题）
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        const hashes = headingMatch[1];
        const text = headingMatch[2];
        const id = `toc-item-${tocIndex}`;
        tocIndex++;

        // 添加 HTML 锚点
        return `${hashes} <span id="${id}"></span>${text}`;
      }

      // 降级匹配一级列表项：行首无空格，以 - 或 * 开头
      const listMatch = /^([-*])\s+(.+)$/.exec(line);
      if (listMatch) {
        const marker = listMatch[1];
        const text = listMatch[2];
        const id = `toc-item-${tocIndex}`;
        tocIndex++;

        // 添加 HTML 锚点（使用 span 避免破坏列表结构）
        return `${marker} <span id="${id}"></span>${text}`;
      }

      return line;
    });

    return processedLines.join("\n");
  }, [content]);

  return (
    <div
      className={`prose prose-sm prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-ul:list-disc prose-ol:list-decimal prose-li:text-gray-700 max-w-none ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // 自定义组件样式
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 border-b border-gray-200 pb-2 text-3xl font-bold text-gray-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-6 border-b border-gray-100 pb-1 text-2xl font-semibold text-gray-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-5 text-xl font-medium text-gray-900">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-lg font-medium text-gray-900">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="mb-2 mt-3 text-base font-medium text-gray-900">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="mb-1 mt-2 text-sm font-medium text-gray-700">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-base leading-relaxed text-gray-700">
              {children}
            </p>
          ),
          a: ({ href, children, ...props }) => {
            const isExternal =
              typeof href === "string" && /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                {...props}
                className="text-blue-600 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-800 hover:decoration-blue-500"
                {...(isExternal
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className ?? "");
            const language = match ? match[1] : "";

            // 内联代码
            if (!match) {
              const codeText = Array.isArray(children)
                ? children.join("")
                : typeof children === "string"
                  ? children
                  : typeof children === "number"
                    ? children.toString()
                    : "";
              const isCopied = copiedText === codeText;

              return (
                <code
                  className="group relative inline cursor-pointer rounded border bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-pink-600 transition-all duration-200 hover:bg-gray-200 hover:shadow-sm"
                  onClick={() => handleInlineCodeCopy(codeText)}
                  title="点击复制"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    maxWidth: "100%",
                    display: "inline-block",
                  }}
                  {...props}
                >
                  <span className={isCopied ? "text-green-600" : ""}>
                    {children}
                  </span>
                  {isCopied && (
                    <span className="ml-1 text-xs font-normal text-green-600">
                      已复制
                    </span>
                  )}
                </code>
              );
            }

            // 代码块 - 使用语法高亮
            return (
              <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="text-xs font-medium uppercase text-gray-600">
                    {language ?? "text"}
                  </span>
                  <button
                    onClick={() => {
                      const codeContent = Array.isArray(children)
                        ? children.join("")
                        : typeof children === "string"
                          ? children
                          : typeof children === "number"
                            ? children.toString()
                            : "";
                      void navigator.clipboard?.writeText(codeContent);
                    }}
                    className="text-xs text-gray-500 transition-colors hover:text-gray-700"
                  >
                    复制
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneLight}
                  language={language}
                  PreTag="div"
                  className="!m-0 !bg-transparent"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
                >
                  {(Array.isArray(children)
                    ? children.join("")
                    : typeof children === "string"
                      ? children
                      : typeof children === "number"
                        ? children.toString()
                        : ""
                  ).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          },

          blockquote: ({ children }) => (
            <blockquote className="mb-6 rounded-r-lg border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-transparent py-4 pl-6 pr-4 italic text-gray-700 shadow-sm">
              <div className="relative">
                <span className="absolute -left-2 -top-1 text-2xl text-blue-400 opacity-50">
                  &ldquo;
                </span>
                {children}
              </div>
            </blockquote>
          ),
          ul: UnorderedList,
          ol: OrderedList,
          li: ({ children, ...props }) => {
            // 检查是否是任务列表项
            const isTaskList = props.className?.includes("task-list-item");

            if (isTaskList) {
              return (
                <li
                  className="flex list-none items-start space-x-2 leading-relaxed text-gray-700"
                  {...props}
                >
                  {children}
                </li>
              );
            }
            return (
              <li className="relative pl-2 leading-relaxed text-gray-700">
                <span className="absolute left-0 top-0 font-bold text-blue-500">
                  •
                </span>
                <div className="ml-3">{children}</div>
              </li>
            );
          },
          hr: () => <hr className="my-6 border-gray-300" />,
          table: ({ children }) => (
            <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-gray-50">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
              {children}
            </td>
          ),
          // GitHub Flavored Markdown 支持
          input: ({ type, checked, disabled }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  readOnly
                />
              );
            }
            return null;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

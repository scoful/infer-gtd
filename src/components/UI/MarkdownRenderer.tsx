import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  theme?: "light" | "dark";
}

export default function MarkdownRenderer({
  content,
  className = "",
  theme = "light",
}: MarkdownRendererProps) {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const handleInlineCodeCopy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    } catch (error) {
      // 降级处理：使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    }
  };
  return (
    <div
      className={`prose prose-sm prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-ul:list-disc prose-ol:list-decimal prose-li:text-gray-700 max-w-none ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义组件样式
          h1: ({ children }) => (
            <h1 className="mt-8 mb-4 text-3xl font-bold text-gray-900 first:mt-0 border-b border-gray-200 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-4 text-2xl font-semibold text-gray-900 border-b border-gray-100 pb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-3 text-xl font-medium text-gray-900">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-2 text-lg font-medium text-gray-900">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="mt-3 mb-2 text-base font-medium text-gray-900">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="mt-2 mb-1 text-sm font-medium text-gray-700">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-gray-700 text-base">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 underline-offset-2 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-gray-700 italic">{children}</em>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            // 内联代码
            if (!match) {
              const codeText = String(children);
              const isCopied = copiedText === codeText;

              return (
                <code
                  className="relative inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-pink-600 border cursor-pointer hover:bg-gray-200 hover:shadow-sm transition-all duration-200 group"
                  onClick={() => handleInlineCodeCopy(codeText)}
                  title="点击复制"
                  {...props}
                >
                  <span className={isCopied ? "text-green-600" : ""}>{children}</span>
                  {isCopied && (
                    <span className="ml-1 text-xs text-green-600 font-normal">已复制</span>
                  )}
                </code>
              );
            }

            // 代码块 - 使用语法高亮
            return (
              <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600 uppercase">
                    {language || "text"}
                  </span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(String(children))}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    复制
                  </button>
                </div>
                <SyntaxHighlighter
                  style={theme === "dark" ? oneDark : oneLight}
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
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          },

          blockquote: ({ children }) => (
            <blockquote className="mb-6 border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-transparent py-4 pl-6 pr-4 italic text-gray-700 rounded-r-lg shadow-sm">
              <div className="relative">
                <span className="absolute -left-2 -top-1 text-2xl text-blue-400 opacity-50">"</span>
                {children}
              </div>
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-4 space-y-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-4 space-y-2">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            // 检查是否是任务列表项
            const isTaskList = props.className?.includes('task-list-item');
            if (isTaskList) {
              return (
                <li className="flex items-start space-x-2 leading-relaxed text-gray-700 list-none" {...props}>
                  {children}
                </li>
              );
            }
            return (
              <li className="leading-relaxed text-gray-700 relative pl-2">
                <span className="absolute left-0 top-0 text-blue-500 font-bold">•</span>
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
            <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
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
        {content}
      </ReactMarkdown>
    </div>
  );
}

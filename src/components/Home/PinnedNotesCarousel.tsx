import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PinnedNote {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  updatedAt: Date;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

interface ContentLine {
  noteId: string;
  noteTitle: string;
  line: string;
  lineIndex: number;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

interface PinnedNotesCarouselProps {
  notes: PinnedNote[];
  autoPlay?: boolean;
  interval?: number;
}

export default function PinnedNotesCarousel({
  notes,
  autoPlay = true,
  interval = 4000,
}: PinnedNotesCarouselProps) {
  const router = useRouter();
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 将所有笔记的内容按行拆分，智能处理长文本
  const contentLines = useMemo(() => {
    const lines: ContentLine[] = [];

    notes.forEach((note) => {
      // 从markdown内容中提取纯文本并按行分割
      const plainText = note.content
        .replace(/#{1,6}\s+/g, '') // 移除标题标记
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
        .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
        .replace(/`(.*?)`/g, '$1') // 移除代码标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
        .trim();

      // 按行分割，过滤空行
      const noteLines = plainText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // 智能处理长文本：将过长的行按句子分割
      noteLines.forEach((line, index) => {
        if (line.length <= 120) {
          // 短文本直接添加
          lines.push({
            noteId: note.id,
            noteTitle: note.title,
            line,
            lineIndex: index,
            project: note.project,
          });
        } else {
          // 长文本按句子分割
          const sentences = line
            .split(/[。！？；.!?;]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

          if (sentences.length > 1) {
            sentences.forEach((sentence, sentenceIndex) => {
              if (sentence.length > 0) {
                lines.push({
                  noteId: note.id,
                  noteTitle: note.title,
                  line: sentence + (sentenceIndex < sentences.length - 1 ? '。' : ''),
                  lineIndex: index,
                  project: note.project,
                });
              }
            });
          } else {
            // 如果没有句子分隔符，按字符数强制分割
            const chunks = [];
            for (let i = 0; i < line.length; i += 100) {
              chunks.push(line.substring(i, i + 100));
            }
            chunks.forEach((chunk, chunkIndex) => {
              lines.push({
                noteId: note.id,
                noteTitle: note.title,
                line: chunk + (chunkIndex < chunks.length - 1 ? '...' : ''),
                lineIndex: index,
                project: note.project,
              });
            });
          }
        }
      });
    });

    return lines;
  }, [notes]);

  // 自动轮播逻辑
  useEffect(() => {
    if (!autoPlay || isPaused || contentLines.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentLineIndex((prev) => (prev + 1) % contentLines.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, isPaused, contentLines.length, interval]);

  // 手动切换
  const goToNext = () => {
    setCurrentLineIndex((prev) => (prev + 1) % contentLines.length);
  };

  const goToPrev = () => {
    setCurrentLineIndex((prev) => (prev - 1 + contentLines.length) % contentLines.length);
  };

  if (!notes || notes.length === 0 || contentLines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <BookmarkSolidIcon className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-light">暂无置顶内容</p>
        </div>
      </div>
    );
  }

  const currentLine = contentLines[currentLineIndex];

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 主要内容区域 - 与页面风格统一 */}
      <div
        className="group h-full rounded-lg bg-white border border-gray-200 shadow-sm p-4 transition-all duration-300 hover:shadow-md hover:border-gray-300 relative overflow-hidden cursor-pointer"
        onClick={() => router.push(`/notes/${currentLine.noteId}`)}
      >
        {/* 顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        {/* 引号装饰 - 更突出的样式 */}
        <div className="absolute top-2 left-2 text-4xl text-blue-400 font-serif leading-none select-none pointer-events-none opacity-80">
          &ldquo;
        </div>
        <div className="absolute bottom-6 right-2 text-4xl text-blue-400 font-serif leading-none select-none pointer-events-none opacity-80">
          &rdquo;
        </div>

        {/* 主要文字内容 */}
        <div className="flex flex-col h-full justify-center px-6 py-3">
          <p className="text-center text-sm lg:text-base font-medium text-gray-800 leading-relaxed group-hover:text-gray-900 transition-colors duration-300 break-words">
            {currentLine.line}
          </p>
        </div>



        {/* 控制按钮 - 在卡片内部 */}
        {contentLines.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 shadow-sm transition-all hover:bg-gray-200 hover:text-gray-800 opacity-0 group-hover:opacity-100"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 shadow-sm transition-all hover:bg-gray-200 hover:text-gray-800 opacity-0 group-hover:opacity-100"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* 进度指示器 - 移到卡片外部底部 */}
      {contentLines.length > 1 && (
        <div className="absolute -bottom-2 right-10 opacity-75 hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-gray-200/50">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 font-medium">
                {currentLineIndex + 1}/{contentLines.length}
              </span>
              <div className="w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${((currentLineIndex + 1) / contentLines.length) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

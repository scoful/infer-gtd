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
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 将所有笔记的内容按行拆分，智能处理长文本
  const contentLines = useMemo(() => {
    const lines: ContentLine[] = [];

    notes.forEach((note) => {
      // 从markdown内容中提取纯文本并按行分割
      const plainText = note.content
        .replace(/#{1,6}\s+/g, "") // 移除标题标记
        .replace(/\*\*(.*?)\*\*/g, "$1") // 移除粗体标记
        .replace(/\*(.*?)\*/g, "$1") // 移除斜体标记
        .replace(/`(.*?)`/g, "$1") // 移除代码标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 移除链接，保留文本
        .trim();

      // 按行分割，过滤空行
      const noteLines = plainText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

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
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          if (sentences.length > 1) {
            sentences.forEach((sentence, sentenceIndex) => {
              if (sentence.length > 0) {
                lines.push({
                  noteId: note.id,
                  noteTitle: note.title,
                  line:
                    sentence +
                    (sentenceIndex < sentences.length - 1 ? "。" : ""),
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
                line: chunk + (chunkIndex < chunks.length - 1 ? "..." : ""),
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

  // 平滑切换函数
  const smoothTransition = (newIndex: number) => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentLineIndex(newIndex);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50); // 短暂延迟确保DOM更新
    }, 200); // 淡出时间
  };

  // 自动轮播逻辑
  useEffect(() => {
    if (!autoPlay || isPaused || contentLines.length <= 1) return;

    const timer = setInterval(() => {
      const nextIndex = (currentLineIndex + 1) % contentLines.length;
      smoothTransition(nextIndex);
    }, interval);

    return () => clearInterval(timer);
  }, [
    autoPlay,
    isPaused,
    contentLines.length,
    interval,
    currentLineIndex,
    isTransitioning,
    smoothTransition,
  ]);

  // 手动切换
  const goToNext = () => {
    const nextIndex = (currentLineIndex + 1) % contentLines.length;
    smoothTransition(nextIndex);
  };

  const goToPrev = () => {
    const prevIndex =
      (currentLineIndex - 1 + contentLines.length) % contentLines.length;
    smoothTransition(prevIndex);
  };

  if (!notes || notes.length === 0 || contentLines.length === 0) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-gray-100/50 shadow-sm">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20"></div>

        <div className="relative z-10 p-6 text-center">
          <div className="relative">
            <BookmarkSolidIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
            </div>
          </div>
          <p className="mb-1 text-sm font-medium text-gray-500">暂无置顶内容</p>
          <p className="text-xs text-gray-400">
            在笔记中点击 ⭐ 来置顶精彩内容
          </p>
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
      {/* 主要内容区域 - 增强视觉质感 */}
      <div
        className="group relative h-full cursor-pointer overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-sm backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-blue-200/60 hover:shadow-lg hover:shadow-blue-100/50"
        onClick={(e) => {
          // 确保点击的不是按钮区域
          if (
            currentLine &&
            (e.target === e.currentTarget ||
              (e.target as HTMLElement).closest(".clickable-content"))
          ) {
            void router.push(`/notes/${currentLine.noteId}`);
          }
        }}
      >
        {/* 顶部装饰条 - 增强动画效果 */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 group-hover:h-1.5"></div>

        {/* 背景光晕效果 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

        {/* 引号装饰 - 增强动画和质感 */}
        <div className="pointer-events-none absolute top-2 left-2 font-serif text-4xl leading-none text-blue-400/70 transition-all duration-300 select-none group-hover:scale-110 group-hover:text-blue-500/90">
          &ldquo;
        </div>
        <div className="pointer-events-none absolute right-2 bottom-6 font-serif text-4xl leading-none text-blue-400/70 transition-all duration-300 select-none group-hover:scale-110 group-hover:text-blue-500/90">
          &rdquo;
        </div>

        {/* 主要文字内容 - 增强动画效果 */}
        <div className="clickable-content relative z-10 flex h-full flex-col justify-center px-6 py-3">
          <p
            className={`text-center text-sm leading-relaxed font-medium break-words text-gray-800 transition-all duration-300 ease-in-out group-hover:text-gray-900 lg:text-base ${
              isTransitioning
                ? "translate-y-3 scale-95 transform opacity-0"
                : "translate-y-0 scale-100 transform opacity-100"
            }`}
          >
            {currentLine?.line}
          </p>
        </div>

        {/* 控制按钮 - 在卡片内部 */}
        {contentLines.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isTransitioning) {
                  goToPrev();
                }
              }}
              disabled={isTransitioning}
              className="absolute top-1/2 left-2 z-20 flex h-8 w-8 -translate-y-1/2 transform items-center justify-center rounded-full border border-gray-200/50 bg-white/80 text-gray-600 opacity-0 shadow-md backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-lg disabled:opacity-50"
            >
              <ChevronLeftIcon className="pointer-events-none h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isTransitioning) {
                  goToNext();
                }
              }}
              disabled={isTransitioning}
              className="absolute top-1/2 right-2 z-20 flex h-8 w-8 -translate-y-1/2 transform items-center justify-center rounded-full border border-gray-200/50 bg-white/80 text-gray-600 opacity-0 shadow-md backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:border-blue-200 hover:bg-white hover:text-blue-600 hover:shadow-lg disabled:opacity-50"
            >
              <ChevronRightIcon className="pointer-events-none h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* 进度指示器 - 居中下方显示 */}
      {contentLines.length > 1 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 transform opacity-75 transition-all duration-300 hover:scale-105 hover:opacity-100">
          <div className="rounded-full border border-gray-200/60 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">
                {currentLineIndex + 1}/{contentLines.length}
              </span>
              <div className="h-1.5 w-8 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out"
                  style={{
                    width: `${((currentLineIndex + 1) / contentLines.length) * 100}%`,
                  }}
                />
              </div>
              {/* 暂停指示器 */}
              {isPaused && (
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400"></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

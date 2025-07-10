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
  }, [autoPlay, isPaused, contentLines.length, interval, currentLineIndex, isTransitioning]);

  // 手动切换
  const goToNext = () => {
    const nextIndex = (currentLineIndex + 1) % contentLines.length;
    smoothTransition(nextIndex);
  };

  const goToPrev = () => {
    const prevIndex = (currentLineIndex - 1 + contentLines.length) % contentLines.length;
    smoothTransition(prevIndex);
  };

  if (!notes || notes.length === 0 || contentLines.length === 0) {
    return (
      <div className="h-full rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200/60 shadow-sm flex items-center justify-center relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20"></div>

        <div className="text-center relative z-10 p-6">
          <div className="relative">
            <BookmarkSolidIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">暂无置顶内容</p>
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
        className="group h-full rounded-xl bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/80 shadow-sm p-4 transition-all duration-500 hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-200/60 hover:-translate-y-0.5 relative overflow-hidden cursor-pointer backdrop-blur-sm"
        onClick={(e) => {
          // 确保点击的不是按钮区域
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.clickable-content')) {
            router.push(`/notes/${currentLine.noteId}`);
          }
        }}
      >
        {/* 顶部装饰条 - 增强动画效果 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 group-hover:h-1.5"></div>

        {/* 背景光晕效果 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        {/* 引号装饰 - 增强动画和质感 */}
        <div className="absolute top-2 left-2 text-4xl text-blue-400/70 font-serif leading-none select-none pointer-events-none transition-all duration-300 group-hover:text-blue-500/90 group-hover:scale-110">
          &ldquo;
        </div>
        <div className="absolute bottom-6 right-2 text-4xl text-blue-400/70 font-serif leading-none select-none pointer-events-none transition-all duration-300 group-hover:text-blue-500/90 group-hover:scale-110">
          &rdquo;
        </div>

        {/* 主要文字内容 - 增强动画效果 */}
        <div className="flex flex-col h-full justify-center px-6 py-3 relative z-10 clickable-content">
          <p
            className={`text-center text-sm lg:text-base font-medium text-gray-800 leading-relaxed group-hover:text-gray-900 break-words transition-all duration-300 ease-in-out ${
              isTransitioning
                ? 'opacity-0 transform translate-y-3 scale-95'
                : 'opacity-100 transform translate-y-0 scale-100'
            }`}
          >
            {currentLine.line}
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
              className="absolute left-2 top-1/2 transform -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-600 shadow-md border border-gray-200/50 transition-all duration-300 hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-lg opacity-0 group-hover:opacity-100 disabled:opacity-50 z-20"
            >
              <ChevronLeftIcon className="h-4 w-4 pointer-events-none" />
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
              className="absolute right-2 top-1/2 transform -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-600 shadow-md border border-gray-200/50 transition-all duration-300 hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-lg opacity-0 group-hover:opacity-100 disabled:opacity-50 z-20"
            >
              <ChevronRightIcon className="h-4 w-4 pointer-events-none" />
            </button>
          </>
        )}
      </div>

      {/* 进度指示器 - 增强视觉效果 */}
      {contentLines.length > 1 && (
        <div className="absolute -bottom-2 right-8 opacity-75 hover:opacity-100 transition-all duration-300 hover:scale-105">
          <div className="bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg border border-gray-200/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">
                {currentLineIndex + 1}/{contentLines.length}
              </span>
              <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out rounded-full"
                  style={{
                    width: `${((currentLineIndex + 1) / contentLines.length) * 100}%`
                  }}
                />
              </div>
              {/* 暂停指示器 */}
              {isPaused && (
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

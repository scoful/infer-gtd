import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  StarIcon,
  ArchiveBoxIcon,
  CalendarIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import { api } from "@/utils/api";
import { QueryLoading, SectionLoading } from "@/components/UI";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface ProjectNoteListProps {
  projectId: string;
  onCreateNote: () => void;
  onEditNote?: (noteId: string) => void;
}

// 笔记卡片组件
interface NoteCardProps {
  note: any;
  onView: () => void;
  onEdit: () => void;
  onPin: () => void;
}

function NoteCard({ note, onView, onEdit, onPin }: NoteCardProps) {
  // 移除内容预览相关函数，现在只显示摘要

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      {/* 头部 */}
      <div className="mb-3 flex items-start justify-between">
        <button
          onClick={onView}
          className="min-w-0 flex-1 text-left hover:text-blue-600"
        >
          <h3 className="truncate text-lg font-semibold text-gray-900">
            {note.title}
          </h3>
        </button>

        <div className="flex flex-shrink-0 items-center space-x-2">
          {note.isArchived && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
              <ArchiveBoxIcon className="mr-1 h-3 w-3" />
              已归档
            </span>
          )}

          {/* 置顶操作按钮 */}
          <button
            onClick={onPin}
            className={`rounded p-1 hover:bg-gray-100 ${
              note.isPinned ? "text-yellow-500" : "text-gray-400"
            }`}
            title={note.isPinned ? "取消置顶" : "置顶笔记"}
          >
            {note.isPinned ? (
              <StarIconSolid className="h-4 w-4" />
            ) : (
              <StarIcon className="h-4 w-4" />
            )}
          </button>

          {/* 编辑按钮 */}
          <button
            onClick={onEdit}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="编辑笔记"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 摘要预览 - 只在有摘要时显示 */}
      {note.summary?.trim() && (
        <div className="mb-4">
          <p className="line-clamp-3 text-sm text-gray-600">
            {note.summary.length > 150
              ? note.summary.substring(0, 150) + "..."
              : note.summary}
          </p>
        </div>
      )}

      {/* 标签 */}
      {note.tags && note.tags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tagRelation: any) => (
              <span
                key={tagRelation.tag.id}
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: tagRelation.tag.color
                    ? `${tagRelation.tag.color}20`
                    : "#f3f4f6",
                  color: tagRelation.tag.color || "#6b7280",
                }}
              >
                <TagIcon className="mr-1 h-3 w-3" />
                {tagRelation.tag.name}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          {note.linkedTasks && note.linkedTasks.length > 0 && (
            <div className="flex items-center">
              <DocumentTextIcon className="mr-1 h-4 w-4" />
              {note.linkedTasks.length} 个关联任务
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <CalendarIcon className="mr-1 h-3 w-3" />
            {new Date(note.updatedAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectNoteList({
  projectId,
  onCreateNote,
  onEditNote,
}: ProjectNoteListProps) {
  const router = useRouter();
  const { showSuccess, showError } = useGlobalNotifications();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState("");

  // 查询参数
  const queryParams = useMemo(
    () => ({
      id: projectId,
      search: searchQuery.trim() || undefined,
      limit: 20,
    }),
    [projectId, searchQuery],
  );

  // 获取项目笔记数据
  const {
    data: notesData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.project.getNotes.useInfiniteQuery(queryParams, {
    enabled: !!projectId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 笔记操作
  const pinNote = api.note.pin.useMutation({
    onSuccess: () => {
      void refetch();
      showSuccess("笔记置顶状态更新成功");
    },
    onError: (error) => {
      showError(`操作失败: ${error.message}`);
    },
  });

  // 合并所有页面的笔记数据
  const notes = useMemo(() => {
    return notesData?.pages.flatMap((page) => page.notes) ?? [];
  }, [notesData]);

  const handleViewNote = (noteId: string) => {
    if (onEditNote) {
      // 使用传入的编辑回调函数（打开模态框）
      onEditNote(noteId);
    } else {
      // 降级到跳转页面
      void router.push(`/notes/${noteId}`);
    }
  };

  const handleEditNote = (noteId: string) => {
    if (onEditNote) {
      // 使用传入的编辑回调函数（打开模态框）
      onEditNote(noteId);
    } else {
      // 降级到跳转页面
      void router.push(`/notes/${noteId}`);
    }
  };

  const handlePinNote = async (noteId: string) => {
    try {
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        await pinNote.mutateAsync({
          id: noteId,
          isPinned: !note.isPinned,
        });
      }
    } catch (error) {
      console.error("更新笔记置顶状态失败:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 搜索和操作 */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-4">
        <div className="flex flex-1 items-center space-x-4">
          {/* 搜索框 */}
          <div className="relative max-w-md flex-1">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={onCreateNote}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            新建笔记
          </button>
        </div>
      </div>

      {/* 笔记列表 */}
      <QueryLoading
        isLoading={isLoading}
        error={null}
        loadingMessage="加载项目笔记中..."
        loadingComponent={<SectionLoading message="加载项目笔记中..." />}
      >
        {notes.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onView={() => handleViewNote(note.id)}
                  onEdit={() => handleEditNote(note.id)}
                  onPin={() => handlePinNote(note.id)}
                />
              ))}
            </div>

            {/* 加载更多按钮 */}
            {hasNextPage && (
              <div className="flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                >
                  {isFetchingNextPage ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无笔记</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? "没有找到匹配的笔记" : "开始为这个项目创建笔记"}
            </p>
            {!searchQuery && (
              <div className="mt-6">
                <button
                  onClick={onCreateNote}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  新建笔记
                </button>
              </div>
            )}
          </div>
        )}
      </QueryLoading>
    </div>
  );
}

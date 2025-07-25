import { type NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ClockIcon,
  LightBulbIcon,
  PlusIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { PageLoading } from "@/components/UI";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { TaskType } from "@prisma/client";

const StreamPage: NextPage = () => {
  const { data: sessionData } = useSession();
  const [newIdea, setNewIdea] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [convertingTaskId, setConvertingTaskId] = useState<string | null>(null);

  // 确保只在客户端渲染动态内容，避免水合错误
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 获取想法流（IDEA状态的任务）- 创意捕获需要较新的数据
  const {
    data: ideasData,
    isLoading,
    refetch,
    isFetching,
  } = api.task.getAll.useQuery(
    {
      limit: 50,
      status: "IDEA", // 只获取想法状态的任务
    },
    {
      enabled: !!sessionData,
      staleTime: 30 * 1000, // 30秒缓存，确保创意同步
      refetchOnWindowFocus: true, // 窗口聚焦时重新获取，适合多设备创意捕获
      refetchOnMount: true, // 每次挂载时重新获取
      refetchOnReconnect: true, // 网络重连时重新获取
    },
  );

  // 注册页面刷新函数
  usePageRefresh(() => {
    void refetch();
  }, [refetch]);

  // 创建新想法
  const createIdea = api.task.create.useMutation({
    onSuccess: () => {
      void refetch();
      setNewIdea("");
    },
  });

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdea.trim()) return;

    try {
      await createIdea.mutateAsync({
        title: newIdea,
        type: TaskType.NORMAL,
      });
    } catch (error) {
      console.error("创建想法失败:", error);
    }
  };

  // 将想法转换为任务
  const convertToTask = api.task.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
      setConvertingTaskId(null); // 清除loading状态
    },
    onError: () => {
      setConvertingTaskId(null); // 清除loading状态
    },
  });

  const handleConvertToTask = async (ideaId: string) => {
    setConvertingTaskId(ideaId); // 设置当前转换的任务ID
    try {
      await convertToTask.mutateAsync({
        id: ideaId,
        status: "TODO",
        note: "从想法转换为待办任务",
      });
    } catch (error) {
      console.error("转换任务失败:", error);
      setConvertingTaskId(null); // 出错时也要清除loading状态
    }
  };

  // 安全的日期格式化函数，避免水合错误
  const formatDateTime = (date: Date) => {
    if (!isClient) {
      return ""; // 服务端渲染时返回空字符串
    }
    return date.toLocaleString("zh-CN");
  };

  // 计算今日新增想法数量
  const getTodayIdeasCount = () => {
    if (!isClient || !ideasData?.tasks) {
      return 0;
    }
    const today = new Date();
    return ideasData.tasks.filter((idea) => {
      const ideaDate = new Date(idea.createdAt);
      return ideaDate.toDateString() === today.toDateString();
    }).length;
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <MainLayout>
          <PageLoading message="加载想法流中..." />
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <Head>
          <title>思绪流 | Infer GTD</title>
          <meta name="description" content="快速捕捉和管理您的想法" />
        </Head>

        <div className="space-y-6">
          {/* 页面标题 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">思绪流</h1>
                {isFetching && !isLoading && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    刷新中...
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                快速捕捉灵感，随时记录想法，轻松转换为可执行任务
              </p>
            </div>
          </div>

          {/* 快速添加想法 */}
          <div className="rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                <LightBulbIcon className="mr-2 inline h-5 w-5 text-yellow-500" />
                记录新想法
              </h3>
              <form onSubmit={handleCreateIdea} className="space-y-4">
                <div>
                  <textarea
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="有什么新想法？随时记录下来..."
                    value={newIdea}
                    onChange={(e) => setNewIdea(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newIdea.trim() || createIdea.isPending}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                  >
                    <PlusIcon className="mr-1.5 -ml-0.5 h-5 w-5" />
                    {createIdea.isPending ? "保存中..." : "添加想法"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <LightBulbIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500">
                        总想法数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {ideasData?.tasks?.length ?? 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500">
                        今日新增
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {getTodayIdeasCount()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TagIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500">
                        待转换
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {ideasData?.tasks?.length ?? 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 想法列表 */}
          <div className="rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                最近的想法
              </h3>

              {ideasData?.tasks && ideasData.tasks.length > 0 ? (
                <div className="space-y-4">
                  {ideasData.tasks.map((idea) => (
                    <div
                      key={idea.id}
                      className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="mb-2 text-base font-medium text-gray-900">
                            {idea.title}
                          </h4>
                          {idea.description && (
                            <p className="mb-3 text-sm text-gray-600">
                              {idea.description}
                            </p>
                          )}

                          {/* 标签和项目 */}
                          <div className="mb-3 flex flex-wrap gap-2">
                            {idea.project && (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: idea.project.color
                                    ? `${idea.project.color}20`
                                    : "#f3f4f6",
                                  color: idea.project.color ?? "#374151",
                                }}
                              >
                                {idea.project.name}
                              </span>
                            )}

                            {idea.tags.map((tagRelation) => (
                              <span
                                key={tagRelation.tag.id}
                                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: tagRelation.tag.color
                                    ? `${tagRelation.tag.color}20`
                                    : "#f3f4f6",
                                  color: tagRelation.tag.color ?? "#374151",
                                }}
                              >
                                <TagIcon className="mr-1 h-3 w-3" />
                                {tagRelation.tag.name}
                              </span>
                            ))}
                          </div>

                          {/* 时间信息 - 使用安全的日期格式化 */}
                          <div className="flex items-center text-xs text-gray-500">
                            <ClockIcon className="mr-1 h-3 w-3" />
                            {isClient && (
                              <span>
                                创建于{" "}
                                {formatDateTime(new Date(idea.createdAt))}
                              </span>
                            )}
                            {!isClient && <span>创建于 ...</span>}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="ml-4 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleConvertToTask(idea.id)}
                            disabled={convertingTaskId === idea.id}
                            className="inline-flex items-center rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
                          >
                            {convertingTaskId === idea.id
                              ? "转换中..."
                              : "转为任务"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <LightBulbIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    暂无想法
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    开始记录您的第一个想法吧！
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
};

export default StreamPage;

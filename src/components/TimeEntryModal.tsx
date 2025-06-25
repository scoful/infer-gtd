import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/utils/api";

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}

interface TimeEntry {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  description: string | null;
}

export default function TimeEntryModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
}: TimeEntryModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");

  // 获取时间记录
  const { data: timeEntries, isLoading } = api.task.getTimeEntries.useQuery(
    { taskId, limit: 100 },
    { enabled: isOpen && !!taskId },
  );

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(date));
  };

  // 格式化持续时间
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // 按日期分组时间记录
  const groupedEntries =
    timeEntries?.entries?.reduce(
      (groups: Record<string, TimeEntry[]>, entry: any) => {
        const date = new Date(entry.startTime).toDateString();
        groups[date] ??= [];
        groups[date].push(entry);
        return groups;
      },
      {} as Record<string, TimeEntry[]>,
    ) ?? {};

  // 计算总时长
  const totalDuration =
    timeEntries?.entries?.reduce((total: number, entry: any) => {
      return total + (entry.duration ?? 0);
    }, 0) ?? 0;

  // 计算当日总时长
  const getDayTotal = (entries: TimeEntry[]) => {
    return entries.reduce((total, entry) => total + (entry.duration ?? 0), 0);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-opacity-25 fixed inset-0 bg-black" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* 标题栏 */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg leading-6 font-medium text-gray-900"
                    >
                      计时明细
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">
                      任务：{taskTitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">关闭</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* 统计信息 */}
                <div className="mb-6 rounded-lg bg-gray-50 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {timeEntries?.entries?.length ?? 0}
                      </div>
                      <div className="text-sm text-gray-500">计时会话</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatDuration(totalDuration)}
                      </div>
                      <div className="text-sm text-gray-500">总计时长</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Object.keys(groupedEntries).length}
                      </div>
                      <div className="text-sm text-gray-500">工作天数</div>
                    </div>
                  </div>
                </div>

                {/* 时间记录列表 */}
                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                      <p className="mt-2 text-gray-500">加载中...</p>
                    </div>
                  ) : Object.keys(groupedEntries).length === 0 ? (
                    <div className="py-8 text-center">
                      <ClockIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                      <p className="text-gray-500">暂无计时记录</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedEntries)
                        .sort(
                          ([a], [b]) =>
                            new Date(b).getTime() - new Date(a).getTime(),
                        )
                        .map(([date, entries]) => (
                          <div key={date} className="rounded-lg border p-4">
                            {/* 日期标题 */}
                            <div className="mb-4 flex items-center justify-between">
                              <h4 className="text-lg font-medium text-gray-900">
                                {new Intl.DateTimeFormat("zh-CN", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  weekday: "long",
                                }).format(new Date(date))}
                              </h4>
                              <span className="text-sm font-medium text-blue-600">
                                当日总计：{formatDuration(getDayTotal(entries))}
                              </span>
                            </div>

                            {/* 当日时间记录 */}
                            <div className="space-y-2">
                              {entries
                                .sort(
                                  (a, b) =>
                                    new Date(a.startTime).getTime() -
                                    new Date(b.startTime).getTime(),
                                )
                                .map((entry, index) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-center justify-between rounded-md bg-gray-50 p-3"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-shrink-0">
                                        {entry.endTime ? (
                                          <PauseIcon className="h-5 w-5 text-red-500" />
                                        ) : (
                                          <PlayIcon className="h-5 w-5 text-green-500" />
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {formatTime(entry.startTime)} -{" "}
                                          {entry.endTime
                                            ? formatTime(entry.endTime)
                                            : "进行中"}
                                        </div>
                                        {entry.description && (
                                          <div className="text-xs text-gray-500">
                                            {entry.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {entry.duration
                                        ? formatDuration(entry.duration)
                                        : "计时中"}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 底部按钮 */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    关闭
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

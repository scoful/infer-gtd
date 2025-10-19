import { useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

interface DateNavigationProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  hasJournalDates?: Set<string>; // 有日记的日期集合
  className?: string;
}

export default function DateNavigation({
  currentDate,
  onDateChange,
  hasJournalDates = new Set(),
  className = "",
}: DateNavigationProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 获取前一天
  const getPreviousDay = () => {
    const prevDay = new Date(currentDate);
    prevDay.setDate(prevDay.getDate() - 1);
    return prevDay;
  };

  // 获取后一天
  const getNextDay = () => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  };

  // 检查是否是今天
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // 检查是否是未来日期
  const isFuture = (date: Date) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  // 检查该日期是否有日记
  const hasJournal = (date: Date) => {
    // 使用本地时区的日期，避免 UTC 时区转换导致的日期偏移
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    return hasJournalDates.has(dateKey);
  };

  // 格式化日期显示
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  // 跳转到今天
  const goToToday = () => {
    onDateChange(new Date());
  };

  // 处理日期选择
  const handleDateSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(event.target.value);
    onDateChange(selectedDate);
    setShowDatePicker(false);
  };

  const nextDay = getNextDay();
  const prevDay = getPreviousDay();

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* 左侧：前一天按钮 */}
      <button
        onClick={() => onDateChange(prevDay)}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        title={`前一天 (${formatDate(prevDay)})`}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="ml-1 hidden sm:inline">前一天</span>
      </button>

      {/* 中间：当前日期显示 */}
      <div className="flex items-center space-x-2">
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-lg font-medium text-gray-900 hover:bg-gray-50"
          >
            <CalendarIcon className="mr-2 h-5 w-5" />
            {formatDate(currentDate)}
            {hasJournal(currentDate) && (
              <span className="ml-2 h-2 w-2 rounded-full bg-blue-500"></span>
            )}
          </button>

          {/* 日期选择器 */}
          {showDatePicker && (
            <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 transform">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <input
                  type="date"
                  value={currentDate.toISOString().split("T")[0]}
                  onChange={handleDateSelect}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 今天按钮 */}
        {!isToday(currentDate) && (
          <button
            onClick={goToToday}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            今天
          </button>
        )}

        {/* 状态指示器 */}
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          {isToday(currentDate) && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
              今天
            </span>
          )}
          {isFuture(currentDate) && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              未来
            </span>
          )}
          {hasJournal(currentDate) && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
              有日记
            </span>
          )}
        </div>
      </div>

      {/* 右侧：后一天按钮 */}
      <button
        onClick={() => onDateChange(nextDay)}
        disabled={isFuture(nextDay)}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          isFuture(nextDay)
            ? "不能查看未来日期"
            : `后一天 (${formatDate(nextDay)})`
        }
      >
        <span className="mr-1 hidden sm:inline">后一天</span>
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

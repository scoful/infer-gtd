/**
 * 时区处理工具函数
 * 解决客户端本地时区与服务端UTC时间的转换问题
 */

/**
 * 将本地时间范围转换为UTC时间范围，用于数据库查询
 * @param localStart 本地时间范围开始
 * @param localEnd 本地时间范围结束
 * @returns UTC时间范围
 */
export function getUTCDateRange(localStart: Date, localEnd: Date) {
  // 本地时间已经是正确的边界，直接返回用于UTC查询
  // 数据库会将这些时间作为UTC时间处理
  return {
    start: localStart,
    end: localEnd,
  };
}

/**
 * 从UTC时间提取本地时区的小时数
 * @param utcDate UTC时间
 * @returns 本地时区的小时数 (0-23)
 */
export function getLocalHour(utcDate: Date): number {
  // 直接使用Date对象的getHours()方法，它会自动转换为本地时区
  return utcDate.getHours();
}

/**
 * 从UTC时间提取本地时区的日期字符串
 * @param utcDate UTC时间
 * @returns 本地日期字符串 (YYYY-MM-DD)
 */
export function getLocalDateString(utcDate: Date): string {
  // 使用本地时区格式化日期
  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 按本地日期对数据进行分组
 * @param items 包含日期字段的数据数组
 * @param dateField 日期字段名
 * @returns 按本地日期分组的数据
 */
export function groupByLocalDate<T>(
  items: T[],
  dateField: keyof T,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  items.forEach((item) => {
    const dateValue = item[dateField];
    if (dateValue instanceof Date) {
      const localDateKey = getLocalDateString(dateValue);
      if (!groups[localDateKey]) {
        groups[localDateKey] = [];
      }
      groups[localDateKey].push(item);
    }
  });

  return groups;
}

/**
 * 按本地小时对数据进行分组统计
 * @param items 包含日期字段的数据数组
 * @param dateField 日期字段名
 * @returns 按小时分组的统计数据 (0-23)
 */
export function groupByLocalHour<T>(
  items: T[],
  dateField: keyof T,
): Record<number, number> {
  const hourCounts: Record<number, number> = {};

  // 初始化24小时
  for (let hour = 0; hour < 24; hour++) {
    hourCounts[hour] = 0;
  }

  items.forEach((item) => {
    const dateValue = item[dateField];
    if (dateValue instanceof Date) {
      const localHour = getLocalHour(dateValue);
      hourCounts[localHour] = (hourCounts[localHour] || 0) + 1;
    }
  });

  return hourCounts;
}

/**
 * 获取本地时区的周范围
 * @param date 参考日期
 * @returns 本地时区的周开始和结束时间
 */
export function getLocalWeekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 周一开始
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 获取本地时区的月范围
 * @param date 参考日期
 * @returns 本地时区的月开始和结束时间
 */
export function getLocalMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 获取本地时区的年范围
 * @param date 参考日期
 * @returns 本地时区的年开始和结束时间
 */
export function getLocalYearRange(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 统一的本地时间格式化函数
 * @param date 日期对象
 * @param options 格式化选项
 * @returns 格式化后的时间字符串
 */
export function formatLocalTime(
  date: Date,
  options: {
    includeDate?: boolean;
    includeTime?: boolean;
    includeSeconds?: boolean;
    locale?: string;
  } = {},
): string {
  const {
    includeDate = true,
    includeTime = true,
    includeSeconds = false,
    locale = "zh-CN",
  } = options;

  const formatOptions: Intl.DateTimeFormatOptions = {};

  if (includeDate) {
    formatOptions.year = "numeric";
    formatOptions.month = "2-digit";
    formatOptions.day = "2-digit";
  }

  if (includeTime) {
    formatOptions.hour = "2-digit";
    formatOptions.minute = "2-digit";
    if (includeSeconds) {
      formatOptions.second = "2-digit";
    }
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(date);
}

/**
 * 检查两个日期是否在同一本地日期
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 是否在同一本地日期
 */
export function isSameLocalDate(date1: Date, date2: Date): boolean {
  return getLocalDateString(date1) === getLocalDateString(date2);
}

/**
 * 获取本地时区的今天日期范围
 * @returns 今天的开始和结束时间
 */
export function getLocalTodayRange() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

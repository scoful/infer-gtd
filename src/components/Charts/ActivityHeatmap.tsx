import React, { useMemo } from "react";

interface ActivityData {
  date: string;
  count: number;
  level: number; // 0-4，对应不同的颜色深度
}

interface ActivityHeatmapProps {
  data: ActivityData[];
  className?: string;
}

export default function ActivityHeatmap({
  data,
  className = "",
}: ActivityHeatmapProps) {
  // 生成过去一年的日期网格
  const { weeks, months } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 重置时间为当天开始

    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // 找到一年前的周日
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks: ActivityData[][] = [];
    const months: { name: string; startWeek: number }[] = [];

    let currentWeek: ActivityData[] = [];
    const currentDate = new Date(startDate);
    let weekIndex = 0;
    let lastMonth = -1;

    // 创建数据映射
    const dataMap = new Map<string, ActivityData>();
    data.forEach((item) => {
      dataMap.set(item.date, item);
    });

    // 动态计算需要的周数，确保包含今天
    let weekCount = 0;
    const tempDate = new Date(startDate);
    while (tempDate <= today) {
      tempDate.setDate(tempDate.getDate() + 7);
      weekCount++;
    }

    // 确保至少有53周，最多55周（避免过多的空白）
    weekCount = Math.max(53, Math.min(55, weekCount));

    // 生成动态周数的数据
    for (let week = 0; week < weekCount; week++) {
      currentWeek = [];

      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().split("T")[0]!;
        const activityData = dataMap.get(dateStr);

        // 检查是否是新月份
        if (currentDate.getMonth() !== lastMonth && day === 0) {
          months.push({
            name: currentDate.toLocaleDateString("zh-CN", { month: "short" }),
            startWeek: weekIndex,
          });
          lastMonth = currentDate.getMonth();
        }

        currentWeek.push({
          date: dateStr,
          count: activityData?.count ?? 0,
          level: activityData?.level ?? 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(currentWeek);
      weekIndex++;
    }

    return { weeks, months };
  }, [data]);

  // 获取颜色类名
  const getColorClass = (level: number): string => {
    const colors = {
      0: "bg-gray-100", // 无活动
      1: "bg-green-200", // 低活动
      2: "bg-green-300", // 中等活动
      3: "bg-green-500", // 高活动
      4: "bg-green-700", // 非常高活动
    };
    return colors[level as keyof typeof colors] || colors[0];
  };

  // 获取工具提示文本
  const getTooltipText = (item: ActivityData): string => {
    const date = new Date(item.date);
    const dateStr = date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (item.count === 0) {
      return `${dateStr}: 无活动`;
    }

    return `${dateStr}: ${item.count} 个操作`;
  };

  // 判断是否是当天
  const isToday = (dateString: string): boolean => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 标题和图例 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">活动热力图</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>少</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-3 w-3 rounded-sm ${getColorClass(level)}`}
              />
            ))}
          </div>
          <span>多</span>
        </div>
      </div>

      {/* 月份标签 */}
      <div className="mb-3 flex">
        <div className="w-4 sm:w-5 md:w-6 lg:w-7 xl:w-8"></div>{" "}
        {/* 星期标签的空间 */}
        <div className="relative ml-1 h-4 flex-1 overflow-hidden">
          {months.map((month, index) => {
            const leftPercent = (month.startWeek * 100) / weeks.length;

            // 过滤逻辑：考虑到要显示13个月，适当放宽条件
            const prevMonth = months[index - 1];
            const shouldShow =
              !prevMonth || month.startWeek - prevMonth.startWeek >= 3;

            if (!shouldShow) return null;

            // 简单的位置处理：最后一个月份放在100%，其他正常计算
            let finalLeftPercent;

            if (index === months.length - 1) {
              // 最后一个月份放在97%位置，平衡显示效果和可见性
              finalLeftPercent = 97;
            } else {
              // 其他月份使用正常计算的位置
              finalLeftPercent = leftPercent;
            }

            return (
              <div
                key={index}
                className="absolute text-xs whitespace-nowrap text-gray-500"
                style={{
                  left: `${finalLeftPercent}%`,
                  top: "0px",
                }}
              >
                {month.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* 热力图网格 */}
      <div className="flex gap-1 pr-1 sm:gap-2">
        {/* 星期标签 */}
        <div className="flex w-4 flex-col justify-around pt-1 text-xs text-gray-500 sm:w-5 md:w-6 lg:w-7 xl:w-8">
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4"></div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4">
            一
          </div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4"></div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4">
            三
          </div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4"></div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4">
            五
          </div>
          <div className="flex h-2 items-center sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4"></div>
        </div>

        {/* 活动网格 - 响应式自适应大小 */}
        <div
          className="grid flex-1 grid-flow-col gap-px pr-1"
          style={{ gridTemplateRows: "repeat(7, 1fr)" }}
        >
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              const isTodaySquare = isToday(day.date);
              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`relative h-2 w-2 rounded-sm sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 ${getColorClass(day.level)} cursor-pointer transition-all hover:ring-1 hover:ring-gray-400`}
                  title={getTooltipText(day)}
                >
                  {isTodaySquare && (
                    <>
                      {/* 脉冲呼吸效果 */}
                      <div
                        className="absolute inset-0 rounded-sm border-2 border-blue-400"
                        style={{
                          animation: "pulse-glow 2s ease-in-out infinite",
                        }}
                      />
                      {/* 内部光晕 */}
                      <div
                        className="absolute inset-0.5 rounded-sm bg-blue-400/20"
                        style={{
                          animation: "inner-glow 2s ease-in-out infinite",
                        }}
                      />
                      <style jsx>{`
                        @keyframes pulse-glow {
                          0%,
                          100% {
                            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
                            transform: scale(1);
                            border-color: rgb(96, 165, 250);
                          }
                          50% {
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0);
                            transform: scale(1.1);
                            border-color: rgb(59, 130, 246);
                          }
                        }

                        @keyframes inner-glow {
                          0%,
                          100% {
                            opacity: 0.2;
                          }
                          50% {
                            opacity: 0.4;
                          }
                        }
                      `}</style>
                    </>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            过去一年共有 {data.reduce((sum, item) => sum + item.count, 0)}{" "}
            个操作
          </span>
          <span>
            最高单日: {Math.max(...data.map((item) => item.count), 0)} 个操作
          </span>
        </div>
      </div>
    </div>
  );
}

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

export default function ActivityHeatmap({ data, className = "" }: ActivityHeatmapProps) {
  // 生成过去一年的日期网格
  const { weeks, months } = useMemo(() => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    // 找到一年前的周日
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const weeks: ActivityData[][] = [];
    const months: { name: string; startWeek: number }[] = [];
    
    let currentWeek: ActivityData[] = [];
    let currentDate = new Date(startDate);
    let weekIndex = 0;
    let lastMonth = -1;
    
    // 创建数据映射
    const dataMap = new Map<string, ActivityData>();
    data.forEach(item => {
      dataMap.set(item.date, item);
    });
    
    // 生成53周的数据（一年多一点）
    for (let week = 0; week < 53; week++) {
      currentWeek = [];

      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().split('T')[0]!;
        const activityData = dataMap.get(dateStr);

        // 检查是否是新月份
        if (currentDate.getMonth() !== lastMonth && day === 0) {
          months.push({
            name: currentDate.toLocaleDateString('zh-CN', { month: 'short' }),
            startWeek: weekIndex
          });
          lastMonth = currentDate.getMonth();
        }

        currentWeek.push({
          date: dateStr,
          count: activityData?.count || 0,
          level: activityData?.level || 0
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
    const dateStr = date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (item.count === 0) {
      return `${dateStr}: 无活动`;
    }
    
    return `${dateStr}: ${item.count} 个操作`;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 标题和图例 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">活动热力图</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>少</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(level => (
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
        <div className="w-4 sm:w-5 md:w-6 lg:w-7 xl:w-8"></div> {/* 星期标签的空间 */}
        <div className="ml-1 flex-1 relative h-4 overflow-hidden">
          {months.map((month, index) => {
            const leftPercent = (month.startWeek * 100) / weeks.length;

            // 过滤逻辑：考虑到要显示13个月，适当放宽条件
            const prevMonth = months[index - 1];
            const shouldShow = !prevMonth || (month.startWeek - prevMonth.startWeek) >= 3;

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
                className="absolute text-xs text-gray-500 whitespace-nowrap"
                style={{
                  left: `${finalLeftPercent}%`,
                  top: '0px'
                }}
              >
                {month.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* 热力图网格 */}
      <div className="flex gap-1 sm:gap-2 pr-1">
        {/* 星期标签 */}
        <div className="flex flex-col justify-around w-4 sm:w-5 md:w-6 lg:w-7 xl:w-8 text-xs text-gray-500 pt-1">
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center"></div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center">一</div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center"></div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center">三</div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center"></div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center">五</div>
          <div className="h-2 sm:h-2.5 md:h-3 lg:h-3.5 xl:h-4 flex items-center"></div>
        </div>

        {/* 活动网格 - 响应式自适应大小 */}
        <div className="flex-1 grid grid-flow-col gap-px pr-1" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 rounded-sm ${getColorClass(day.level)} hover:ring-1 hover:ring-gray-400 cursor-pointer transition-all`}
                title={getTooltipText(day)}
              />
            ))
          )}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            过去一年共有 {data.reduce((sum, item) => sum + item.count, 0)} 个操作
          </span>
          <span>
            最高单日: {Math.max(...data.map(item => item.count), 0)} 个操作
          </span>
        </div>
      </div>
    </div>
  );
}

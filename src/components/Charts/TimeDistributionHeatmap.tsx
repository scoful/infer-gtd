import React from "react";

interface TimeDistributionData {
  hour: number;
  count: number;
}

interface TimeDistributionHeatmapProps {
  data: Record<number, number>;
  maxCount?: number;
}

const TimeDistributionHeatmap: React.FC<TimeDistributionHeatmapProps> = ({
  data,
  maxCount,
}) => {
  // 生成24小时的数据
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const max = maxCount || Math.max(...Object.values(data), 1);

  // 获取颜色强度
  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    return Math.min(count / max, 1);
  };

  // 获取颜色类名
  const getColorClass = (intensity: number) => {
    if (intensity === 0) return "bg-gray-100";
    if (intensity <= 0.2) return "bg-blue-100";
    if (intensity <= 0.4) return "bg-blue-200";
    if (intensity <= 0.6) return "bg-blue-300";
    if (intensity <= 0.8) return "bg-blue-400";
    return "bg-blue-500";
  };

  // 获取文本颜色
  const getTextColor = (intensity: number) => {
    return intensity > 0.6 ? "text-white" : "text-gray-700";
  };

  // 格式化时间
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">任务完成时间分布</h4>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>少</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded bg-gray-100"></div>
            <div className="h-3 w-3 rounded bg-blue-100"></div>
            <div className="h-3 w-3 rounded bg-blue-200"></div>
            <div className="h-3 w-3 rounded bg-blue-300"></div>
            <div className="h-3 w-3 rounded bg-blue-400"></div>
            <div className="h-3 w-3 rounded bg-blue-500"></div>
          </div>
          <span>多</span>
        </div>
      </div>

      {/* 桌面端网格布局 */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-12 gap-1">
          {hours.map((hour) => {
            const count = data[hour] || 0;
            const intensity = getIntensity(count);
            const colorClass = getColorClass(intensity);
            const textColor = getTextColor(intensity);

            return (
              <div
                key={hour}
                className={`group relative flex h-16 cursor-pointer items-center justify-center rounded-lg transition-all hover:scale-105 ${colorClass}`}
                title={`${formatHour(hour)}: ${count} 个任务`}
              >
                <div className={`text-center ${textColor}`}>
                  <div className="text-xs font-medium">{formatHour(hour)}</div>
                  <div className="text-xs">{count}</div>
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 transform rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  {formatHour(hour)}: {count} 个任务
                  <div className="absolute top-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 移动端列表布局 */}
      <div className="block sm:hidden">
        <div className="space-y-2">
          {hours
            .filter((hour) => (data[hour] || 0) > 0)
            .sort((a, b) => (data[b] || 0) - (data[a] || 0))
            .slice(0, 8) // 只显示前8个最活跃的时段
            .map((hour) => {
              const count = data[hour] || 0;
              const intensity = getIntensity(count);
              const percentage = (count / max) * 100;

              return (
                <div key={hour} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-medium text-gray-700">
                    {formatHour(hour)}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-8 text-sm text-gray-600">{count}</div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
        <div>
          <div className="font-medium text-gray-900">
            {Object.values(data).reduce((sum, count) => sum + count, 0)}
          </div>
          <div className="text-gray-500">总完成任务</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {Object.keys(data).filter((hour) => data[parseInt(hour)] > 0).length}
          </div>
          <div className="text-gray-500">活跃时段</div>
        </div>
      </div>
    </div>
  );
};

export default TimeDistributionHeatmap;

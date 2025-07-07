import React from "react";

interface SimpleDailyCompletionProps {
  data: Record<string, number>;
  timeRange: "week" | "month" | "year";
  dateRange: { start: Date; end: Date };
}

const SimpleDailyCompletion: React.FC<SimpleDailyCompletionProps> = ({
  data,
  timeRange,
  dateRange,
}) => {
  // 生成完整的日期范围数据
  const generateDateRange = () => {
    const dates: Array<{ date: string; count: number; dayOfWeek: string; isWeekend: boolean }> = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      const dateKey = current.toISOString().split("T")[0]!;
      const dayOfWeek = current.toLocaleDateString("zh-CN", { weekday: "short" });
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      
      dates.push({
        date: dateKey,
        count: data[dateKey] || 0,
        dayOfWeek,
        isWeekend,
      });

      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const chartData = generateDateRange();
  const totalCompleted = Object.values(data).reduce((sum, count) => sum + count, 0);
  const averagePerDay = chartData.length > 0 ? totalCompleted / chartData.length : 0;
  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timeRange === "week") {
      return date.toLocaleDateString("zh-CN", { weekday: "short" });
    } else if (timeRange === "month") {
      return `${date.getDate()}日`;
    } else {
      return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无完成数据</div>
          <div className="text-sm">完成一些任务后这里会显示每日完成趋势</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 图表 */}
      <div className="relative h-60 overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
        {/* Y轴标签 */}
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between py-4 text-xs text-gray-500">
          <span>{maxCount}</span>
          <span>{Math.round(maxCount * 0.75)}</span>
          <span>{Math.round(maxCount * 0.5)}</span>
          <span>{Math.round(maxCount * 0.25)}</span>
          <span>0</span>
        </div>

        {/* 平均线 */}
        <div 
          className="absolute left-8 right-4 border-t-2 border-dashed border-red-400"
          style={{ 
            top: `${20 + (1 - averagePerDay / maxCount) * 60}%`
          }}
        >
          <span className="absolute -top-5 right-0 text-xs text-red-500">
            平均: {averagePerDay.toFixed(1)}
          </span>
        </div>

        {/* 柱状图 */}
        <div className="ml-8 flex h-full items-end justify-between gap-1 py-4">
          {chartData.map((item) => {
            const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            const barColor = item.isWeekend ? "bg-gray-400" : "bg-blue-500";
            const hoverColor = item.isWeekend ? "group-hover:bg-gray-500" : "group-hover:bg-blue-600";

            return (
              <div key={item.date} className="group relative flex flex-1 flex-col items-center">
                {/* 柱子 */}
                <div
                  className={`w-full max-w-8 rounded-t transition-all ${barColor} ${hoverColor}`}
                  style={{ height: `${height}%` }}
                ></div>

                {/* X轴标签 */}
                <div className="mt-2 text-xs text-gray-500">
                  {formatDate(item.date)}
                </div>

                {/* 悬停提示 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 transform rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  <div>{new Date(item.date).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</div>
                  <div>完成任务: {item.count} 个</div>
                  {item.isWeekend && <div className="text-yellow-300">周末</div>}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{totalCompleted}</div>
          <div className="text-sm text-gray-500">总完成任务</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-green-600">
            {averagePerDay.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500">日均完成</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-purple-600">
            {Math.max(...chartData.map(d => d.count))}
          </div>
          <div className="text-sm text-gray-500">单日最高</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-orange-600">
            {chartData.filter(d => d.count > 0).length}
          </div>
          <div className="text-sm text-gray-500">活跃天数</div>
        </div>
      </div>

      {/* 工作模式分析 */}
      <div className="mt-4 rounded-lg bg-green-50 p-4">
        <h4 className="text-sm font-medium text-green-900">工作模式分析</h4>
        <div className="mt-2 space-y-1 text-sm text-green-700">
          {(() => {
            const weekdayData = chartData.filter(d => !d.isWeekend);
            const weekendData = chartData.filter(d => d.isWeekend);
            
            const weekdayTotal = weekdayData.reduce((sum, d) => sum + d.count, 0);
            const weekendTotal = weekendData.reduce((sum, d) => sum + d.count, 0);
            
            const weekdayAvg = weekdayData.length > 0 ? weekdayTotal / weekdayData.length : 0;
            const weekendAvg = weekendData.length > 0 ? weekendTotal / weekendData.length : 0;
            
            const insights = [];
            
            if (weekdayAvg > weekendAvg * 2) {
              insights.push("工作日效率明显高于周末，工作节奏良好");
            } else if (weekendAvg > weekdayAvg) {
              insights.push("周末完成任务较多，注意工作生活平衡");
            } else {
              insights.push("工作日和周末任务完成较为均衡");
            }
            
            const activeDays = chartData.filter(d => d.count > 0).length;
            const totalDays = chartData.length;
            const activeRate = (activeDays / totalDays) * 100;
            
            if (activeRate > 80) {
              insights.push(`活跃度很高 (${activeRate.toFixed(0)}%)，保持良好习惯`);
            } else if (activeRate > 60) {
              insights.push(`活跃度良好 (${activeRate.toFixed(0)}%)，可以继续提升`);
            } else {
              insights.push(`活跃度有待提高 (${activeRate.toFixed(0)}%)，建议制定更规律的计划`);
            }
            
            return insights.map((insight, index) => (
              <p key={index}>• {insight}</p>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

export default SimpleDailyCompletion;

import React from "react";

interface TrendData {
  date: string;
  completed: number;
  total: number;
  completionRate: number;
}

interface SimpleCompletionTrendProps {
  data: TrendData[];
  timeRange: "week" | "month" | "year";
}

const SimpleCompletionTrend: React.FC<SimpleCompletionTrendProps> = ({
  data,
  timeRange,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无趋势数据</div>
          <div className="text-sm">完成一些任务后这里会显示完成趋势</div>
        </div>
      </div>
    );
  }

  const maxCompleted = Math.max(...data.map(d => d.completed), 1);
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const maxValue = Math.max(maxCompleted, maxTotal);

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

  return (
    <div className="w-full">
      {/* 图例 */}
      <div className="mb-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gray-300"></div>
          <span className="text-gray-600">总任务</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">完成率</span>
        </div>
      </div>

      {/* 趋势图 */}
      <div className="relative h-60 overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
        {/* Y轴标签 */}
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between py-4 text-xs text-gray-500">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>

        {/* 图表区域 */}
        <div className="ml-8 flex h-full items-end justify-between gap-1">
          {data.map((item, index) => {
            const completedHeight = maxValue > 0 ? (item.completed / maxValue) * 100 : 0;
            const totalHeight = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
            const completionRate = item.completionRate;

            return (
              <div key={item.date} className="group relative flex flex-1 flex-col items-center">
                {/* 柱状图 */}
                <div className="relative flex w-full max-w-12 items-end justify-center gap-1">
                  {/* 总任务柱 */}
                  <div
                    className="w-3 rounded-t bg-gray-300 transition-all group-hover:bg-gray-400"
                    style={{ height: `${totalHeight}%` }}
                  ></div>
                  {/* 完成任务柱 */}
                  <div
                    className="w-3 rounded-t bg-blue-500 transition-all group-hover:bg-blue-600"
                    style={{ height: `${completedHeight}%` }}
                  ></div>
                  {/* 完成率指示器 */}
                  <div
                    className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-green-500"
                    style={{ 
                      transform: `translateX(-50%) translateY(-${completionRate}%)`,
                      opacity: completionRate > 0 ? 1 : 0
                    }}
                  ></div>
                </div>

                {/* X轴标签 */}
                <div className="mt-2 text-xs text-gray-500">
                  {formatDate(item.date)}
                </div>

                {/* 悬停提示 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 transform rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  <div>总任务: {item.total}</div>
                  <div>已完成: {item.completed}</div>
                  <div>完成率: {completionRate.toFixed(1)}%</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-blue-600">
            {data.reduce((sum, item) => sum + item.completed, 0)}
          </div>
          <div className="text-sm text-gray-500">总完成</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-gray-600">
            {data.reduce((sum, item) => sum + item.total, 0)}
          </div>
          <div className="text-sm text-gray-500">总创建</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-green-600">
            {data.length > 0 ? 
              (data.reduce((sum, item) => sum + item.completionRate, 0) / data.length).toFixed(1)
              : 0
            }%
          </div>
          <div className="text-sm text-gray-500">平均完成率</div>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-purple-600">
            {Math.max(...data.map(d => d.completionRate))}%
          </div>
          <div className="text-sm text-gray-500">最高完成率</div>
        </div>
      </div>
    </div>
  );
};

export default SimpleCompletionTrend;

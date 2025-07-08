import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface DailyCompletionData {
  date: string;
  count: number;
  dayOfWeek: string;
  isWeekend: boolean;
}

interface DailyCompletionChartProps {
  data: Record<string, number>;
  timeRange: "week" | "month" | "year";
  dateRange: { start: Date; end: Date };
}

const DailyCompletionChart: React.FC<DailyCompletionChartProps> = ({
  data,
  timeRange,
  dateRange,
}) => {
  // 生成完整的日期范围数据
  const generateDateRange = () => {
    const dates: DailyCompletionData[] = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      const dateKey = current.toISOString().split("T")[0]!;
      const dayOfWeek = current.toLocaleDateString("zh-CN", {
        weekday: "short",
      });
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
  const totalCompleted = Object.values(data).reduce(
    (sum, count) => sum + count,
    0,
  );
  const averagePerDay =
    chartData.length > 0 ? totalCompleted / chartData.length : 0;

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      const date = new Date(data.date);
      const formattedDate = date.toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
      });

      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">{formattedDate}</p>
          <div className="mt-1">
            <p className="text-sm text-blue-600">完成任务: {data.count} 个</p>
            {data.isWeekend && <p className="text-xs text-gray-500">周末</p>}
          </div>
        </div>
      );
    }
    return null;
  };

  // 格式化 X 轴标签
  const formatXAxisLabel = (value: string) => {
    const date = new Date(value);
    if (timeRange === "week") {
      return date.toLocaleDateString("zh-CN", { weekday: "short" });
    } else if (timeRange === "month") {
      return `${date.getDate()}日`;
    } else {
      return date.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // 如果没有数据
  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无完成数据</div>
          <div className="text-sm">完成一些任务后这里会显示每日完成趋势</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisLabel}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            {/* 平均线 */}
            <ReferenceLine
              y={averagePerDay}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `平均: ${averagePerDay.toFixed(1)}`,
                position: "topRight",
              }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]} fill="#3b82f6">
              {chartData.map((entry, index) => {
                const color = entry.isWeekend ? "#94a3b8" : "#3b82f6";
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 统计信息 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {totalCompleted}
          </div>
          <div className="text-sm text-gray-500">总完成任务</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {averagePerDay.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500">日均完成</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.max(...chartData.map((d) => d.count))}
          </div>
          <div className="text-sm text-gray-500">单日最高</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {chartData.filter((d) => d.count > 0).length}
          </div>
          <div className="text-sm text-gray-500">活跃天数</div>
        </div>
      </div>

      {/* 工作模式分析 */}
      <div className="mt-6 rounded-lg bg-green-50 p-4">
        <h4 className="text-sm font-medium text-green-900">工作模式分析</h4>
        <div className="mt-2 space-y-1 text-sm text-green-700">
          {(() => {
            const weekdayData = chartData.filter((d) => !d.isWeekend);
            const weekendData = chartData.filter((d) => d.isWeekend);

            const weekdayTotal = weekdayData.reduce(
              (sum, d) => sum + d.count,
              0,
            );
            const weekendTotal = weekendData.reduce(
              (sum, d) => sum + d.count,
              0,
            );

            const weekdayAvg =
              weekdayData.length > 0 ? weekdayTotal / weekdayData.length : 0;
            const weekendAvg =
              weekendData.length > 0 ? weekendTotal / weekendData.length : 0;

            const insights = [];

            if (weekdayAvg > weekendAvg * 2) {
              insights.push("工作日效率明显高于周末，工作节奏良好");
            } else if (weekendAvg > weekdayAvg) {
              insights.push("周末完成任务较多，注意工作生活平衡");
            } else {
              insights.push("工作日和周末任务完成较为均衡");
            }

            const activeDays = chartData.filter((d) => d.count > 0).length;
            const totalDays = chartData.length;
            const activeRate = (activeDays / totalDays) * 100;

            if (activeRate > 80) {
              insights.push(
                `活跃度很高 (${activeRate.toFixed(0)}%)，保持良好习惯`,
              );
            } else if (activeRate > 60) {
              insights.push(
                `活跃度良好 (${activeRate.toFixed(0)}%)，可以继续提升`,
              );
            } else {
              insights.push(
                `活跃度有待提高 (${activeRate.toFixed(0)}%)，建议制定更规律的计划`,
              );
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

export default DailyCompletionChart;

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-white p-3 shadow-lg">
          <p className="font-medium">{`日期: ${formatDate(label)}`}</p>
          <p className="text-blue-600">{`完成任务: ${data.count}`}</p>
          <p className="text-gray-500">{`${data.dayOfWeek}${data.isWeekend ? " (周末)" : ""}`}</p>
        </div>
      );
    }
    return null;
  };

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
            data={chartData.map(item => ({
              ...item,
              date: formatDate(item.date)
            }))}
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
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              radius={[2, 2, 0, 0]}
              fill="#3b82f6"
            >
              {chartData.map((entry, index) => {
                const color = entry.isWeekend ? "#9ca3af" : "#3b82f6";
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SimpleDailyCompletion;

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无趋势数据</div>
          <div className="text-sm">完成一些任务后这里会显示完成趋势</div>
        </div>
      </div>
    );
  }

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
      return (
        <div className="rounded-lg border bg-white p-3 shadow-lg">
          <p className="font-medium">{`日期: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}${entry.dataKey === "completionRate" ? "%" : ""}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.map(item => ({
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
              yAxisId="count"
              orientation="left"
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="completed"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
              name="已完成"
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="total"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#9ca3af", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#9ca3af", strokeWidth: 2 }}
              name="总任务"
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="completionRate"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
              name="完成率(%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SimpleCompletionTrend;

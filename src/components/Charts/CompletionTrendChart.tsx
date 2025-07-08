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

interface CompletionTrendData {
  date: string;
  created: number;      // 新建任务数
  completed: number;    // 完成任务数
  completionRate: number; // 完成率
}

interface CompletionTrendChartProps {
  data: CompletionTrendData[];
  timeRange: "week" | "month" | "year";
}

const CompletionTrendChart: React.FC<CompletionTrendChartProps> = ({
  data,
  timeRange,
}) => {
  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-orange-600">
              新建: {data.created} 个任务
            </p>
            <p className="text-sm text-blue-600">
              完成: {data.completed} 个任务
            </p>
            <p className="text-sm text-green-600">
              完成率: {data.completionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // 格式化 X 轴标签
  const formatXAxisLabel = (value: string) => {
    if (timeRange === "week") {
      // 周视图显示星期几
      const date = new Date(value);
      return date.toLocaleDateString("zh-CN", { weekday: "short" });
    } else if (timeRange === "month") {
      // 月视图显示日期
      const date = new Date(value);
      return `${date.getDate()}日`;
    } else {
      // 年视图显示月份
      const date = new Date(value);
      return `${date.getMonth() + 1}月`;
    }
  };

  // 如果没有数据
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

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
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
            dataKey="created"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: "#f97316", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "#f97316", strokeWidth: 2 }}
            name="新建任务数"
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="completed"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
            name="完成任务数"
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="completionRate"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
            name="完成率 (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompletionTrendChart;

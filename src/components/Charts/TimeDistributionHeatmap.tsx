import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimeDistributionData {
  hour: number;
  created: number;
  completed: number;
}

interface TimeDistributionHeatmapProps {
  data: Record<number, { created: number; completed: number }>;
  maxCount?: number;
}

const TimeDistributionHeatmap: React.FC<TimeDistributionHeatmapProps> = ({
  data,
  maxCount,
}) => {
  // 生成24小时的数据
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const allCounts = Object.values(data).flatMap((d) => [
    d.created,
    d.completed,
  ]);
  const max = maxCount || Math.max(...allCounts, 1);

  // 格式化时间
  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  // 准备图表数据
  const chartData = hours.map((hour) => ({
    hour: formatHour(hour),
    created: data[hour]?.created || 0,
    completed: data[hour]?.completed || 0,
    hourNumber: hour,
  }));

  // 获取颜色强度
  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    return Math.min(count / max, 1);
  };

  // 获取颜色
  const getColor = (intensity: number) => {
    if (intensity === 0) return "#f3f4f6";
    if (intensity <= 0.2) return "#dbeafe";
    if (intensity <= 0.4) return "#bfdbfe";
    if (intensity <= 0.6) return "#93c5fd";
    if (intensity <= 0.8) return "#60a5fa";
    return "#3b82f6";
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-white p-3 shadow-lg">
          <p className="font-medium">{`时间: ${label}`}</p>
          <p className="text-orange-600">{`新建任务: ${data.created}`}</p>
          <p className="text-blue-600">{`完成任务: ${data.completed}`}</p>
        </div>
      );
    }
    return null;
  };

  // 如果没有数据
  if (
    Object.keys(data).length === 0 ||
    Object.values(data).every((d) => d.created === 0 && d.completed === 0)
  ) {
    return (
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无时间分布数据</div>
          <div className="text-sm">完成一些任务后这里会显示时间分布</div>
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
            <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} interval={1} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="created"
              radius={[2, 2, 0, 0]}
              fill="#f97316"
              name="新建任务"
            />
            <Bar
              dataKey="completed"
              radius={[2, 2, 0, 0]}
              fill="#3b82f6"
              name="完成任务"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <div className="font-medium text-orange-600">
            {Object.values(data).reduce((sum, d) => sum + d.created, 0)}
          </div>
          <div className="text-gray-500">总新建任务</div>
        </div>
        <div>
          <div className="font-medium text-blue-600">
            {Object.values(data).reduce((sum, d) => sum + d.completed, 0)}
          </div>
          <div className="text-gray-500">总完成任务</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {
              Object.keys(data).filter((hour) => {
                const d = data[parseInt(hour)];
                return d && (d.created > 0 || d.completed > 0);
              }).length
            }
          </div>
          <div className="text-gray-500">活跃时段</div>
        </div>
      </div>
    </div>
  );
};

export default TimeDistributionHeatmap;

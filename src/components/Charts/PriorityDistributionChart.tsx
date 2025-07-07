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
import { Priority } from "@prisma/client";

interface PriorityDistributionData {
  priority: string;
  count: number;
  percentage: number;
  color: string;
}

interface PriorityDistributionChartProps {
  data: Record<Priority, number>;
  totalTasks: number;
}

const PriorityDistributionChart: React.FC<PriorityDistributionChartProps> = ({
  data,
  totalTasks,
}) => {
  // 优先级配置
  const priorityConfig = {
    [Priority.URGENT]: { label: "紧急", color: "#ef4444" }, // red-500
    [Priority.HIGH]: { label: "高", color: "#f97316" }, // orange-500
    [Priority.MEDIUM]: { label: "中", color: "#eab308" }, // yellow-500
    [Priority.LOW]: { label: "低", color: "#22c55e" }, // green-500
  };

  // 转换数据格式
  const chartData: PriorityDistributionData[] = Object.entries(priorityConfig)
    .map(([priority, config]) => {
      const count = data[priority as Priority] || 0;
      const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
      return {
        priority: config.label,
        count,
        percentage,
        color: config.color,
      };
    })
    .filter((item) => item.count > 0); // 只显示有数据的优先级

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {label}优先级
          </p>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-blue-600">
              任务数: {data.count} 个
            </p>
            <p className="text-sm text-gray-600">
              占比: {data.percentage.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // 获取柱状图颜色
  const getBarColor = (index: number) => {
    return chartData[index]?.color || "#3b82f6";
  };

  // 如果没有数据
  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无优先级数据</div>
          <div className="text-sm">创建一些任务后这里会显示优先级分布</div>
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
              dataKey="priority"
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
              radius={[4, 4, 0, 0]}
              fill="#3b82f6"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 统计卡片 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(priorityConfig).map(([priority, config]) => {
          const count = data[priority as Priority] || 0;
          const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
          
          return (
            <div
              key={priority}
              className="rounded-lg border border-gray-200 bg-white p-4 text-center"
            >
              <div className="flex items-center justify-center">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: config.color }}
                ></div>
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {config.label}优先级
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-gray-900">
                  {count}
                </div>
                <div className="text-sm text-gray-500">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 优先级建议 */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900">优先级分析</h4>
        <div className="mt-2 space-y-1 text-sm text-blue-700">
          {(() => {
            const urgentCount = data[Priority.URGENT] || 0;
            const highCount = data[Priority.HIGH] || 0;
            const urgentPercentage = totalTasks > 0 ? (urgentCount / totalTasks) * 100 : 0;
            const highPercentage = totalTasks > 0 ? (highCount / totalTasks) * 100 : 0;
            
            const insights = [];
            
            if (urgentPercentage > 30) {
              insights.push("紧急任务占比较高，建议优化时间管理");
            } else if (urgentPercentage < 5) {
              insights.push("紧急任务控制良好，时间规划合理");
            }
            
            if (highPercentage + urgentPercentage > 50) {
              insights.push("高优先级任务较多，注意工作负荷");
            }
            
            if (insights.length === 0) {
              insights.push("优先级分布合理，继续保持");
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

export default PriorityDistributionChart;

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
import { TaskStatus } from "@prisma/client";

interface StatusDistributionData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface StatusDistributionChartProps {
  data: Record<TaskStatus, number>;
}

const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  data,
}) => {
  // 状态配置
  const statusConfig = {
    IDEA: { label: "想法", color: "#8b5cf6" }, // violet-500
    TODO: { label: "待处理", color: "#3b82f6" }, // blue-500
    IN_PROGRESS: { label: "进行中", color: "#f59e0b" }, // amber-500
    WAITING: { label: "等待中", color: "#6b7280" }, // gray-500
    DONE: { label: "已完成", color: "#10b981" }, // emerald-500
    ARCHIVED: { label: "已归档", color: "#64748b" }, // slate-500
  };

  // 计算总任务数
  const totalTasks = Object.values(data).reduce((sum, count) => sum + count, 0);

  // 转换数据格式 - 显示所有状态，包括数量为0的
  const chartData: StatusDistributionData[] = Object.entries(statusConfig)
    .map(([status, config]) => {
      const count = data[status as TaskStatus] || 0;
      const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
      return {
        status: config.label,
        count,
        percentage,
        color: config.color,
      };
    }); // 显示所有状态，包括数量为0的

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {label}状态
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

  // 如果没有任务数据
  if (totalTasks === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无状态数据</div>
          <div className="text-sm">创建一些任务后这里会显示状态分布</div>
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
            maxBarSize={60}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="status"
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
              radius={[6, 6, 0, 0]}
              fill="#3b82f6"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 统计卡片 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = data[status as TaskStatus] || 0;
          const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
          
          return (
            <div
              key={status}
              className="rounded-lg border border-gray-200 bg-white p-3 text-center"
            >
              <div className="flex items-center justify-center">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                ></div>
                <span className="ml-2 text-xs font-medium text-gray-700">
                  {config.label}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-gray-900">
                  {count}
                </div>
                <div className="text-xs text-gray-500">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 状态分析 */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-900">状态分析</h4>
        <div className="mt-2 space-y-1 text-sm text-blue-700">
          {(() => {
            const doneCount = data.DONE || 0;
            const inProgressCount = data.IN_PROGRESS || 0;
            const todoCount = data.TODO || 0;
            const waitingCount = data.WAITING || 0;
            
            const insights = [];
            
            if (doneCount > totalTasks * 0.6) {
              insights.push("✅ 完成率很高，工作效率出色");
            } else if (doneCount < totalTasks * 0.3) {
              insights.push("⚠️ 完成率较低，建议关注任务执行");
            }
            
            if (inProgressCount > totalTasks * 0.4) {
              insights.push("🔄 进行中任务较多，注意合理安排");
            }
            
            if (waitingCount > totalTasks * 0.2) {
              insights.push("⏳ 等待中任务较多，可能存在依赖阻塞");
            }
            
            if (todoCount > totalTasks * 0.5) {
              insights.push("📋 待处理任务堆积，建议优先处理");
            }
            
            if (insights.length === 0) {
              insights.push("📊 任务状态分布均衡");
            }
            
            return insights.map((insight, index) => (
              <p key={index}>{insight}</p>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

export default StatusDistributionChart;

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface ProjectCompletionData {
  name: string;
  total: number;
  completed: number;
  completionRate: number;
}

interface ProjectCompletionPieChartProps {
  data: Record<string, { total: number; completed: number }>;
}

const ProjectCompletionPieChart: React.FC<ProjectCompletionPieChartProps> = ({
  data,
}) => {
  // 转换数据格式
  const chartData: ProjectCompletionData[] = Object.entries(data).map(
    ([name, stats]) => ({
      name: name === "无项目" ? "未分类" : name,
      total: stats.total,
      completed: stats.completed,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
    })
  );

  // 颜色配置
  const COLORS = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#06b6d4", // cyan-500
    "#84cc16", // lime-500
    "#f97316", // orange-500
    "#ec4899", // pink-500
    "#6b7280", // gray-500
  ];

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-blue-600">
              总任务: {data.total} 个
            </p>
            <p className="text-sm text-green-600">
              已完成: {data.completed} 个
            </p>
            <p className="text-sm text-gray-600">
              完成率: {data.completionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // 自定义标签
  const renderLabel = (entry: ProjectCompletionData) => {
    if (entry.total < 2) return ""; // 任务数太少不显示标签
    return `${entry.completionRate.toFixed(0)}%`;
  };

  // 如果没有数据
  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">暂无项目数据</div>
          <div className="text-sm">完成一些任务后这里会显示项目分布</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="total"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: any) => (
                <span className="text-sm text-gray-700">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 详细统计表格 */}
      <div className="mt-6">
        <h4 className="mb-3 text-sm font-medium text-gray-700">项目详情</h4>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  项目
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  总任务
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  已完成
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  完成率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {chartData
                .sort((a, b) => b.completionRate - a.completionRate)
                .map((project, index) => (
                  <tr key={project.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <div
                          className="mr-2 h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900">
                          {project.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-gray-600">
                      {project.total}
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-gray-600">
                      {project.completed}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${project.completionRate}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {project.completionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectCompletionPieChart;

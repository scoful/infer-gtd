import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface ProjectData {
  name: string;
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
}

interface ProjectCompletionPieChartProps {
  data: Record<string, { total: number; completed: number }>;
}

const ProjectCompletionPieChart: React.FC<ProjectCompletionPieChartProps> = ({
  data,
}) => {
  // 转换数据格式 - 每个项目显示已完成和待完成的分布
  const projectsData: ProjectData[] = Object.entries(data)
    .filter(([, stats]) => stats.total > 0) // 只显示有任务的项目
    .map(([name, stats]) => ({
      name: name === "无项目" ? "未分类" : name,
      total: stats.total,
      completed: stats.completed,
      pending: stats.total - stats.completed,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
    }));

  // 颜色配置 - 已完成和待完成的颜色
  const COMPLETION_COLORS = {
    completed: "#10b981", // green-500 已完成
    pending: "#f3f4f6",   // gray-100 待完成
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isCompleted = data.name.includes("已完成");
      const projectName = data.projectName;
      const projectData = projectsData.find(p => p.name === projectName);

      return (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900">{projectName}</p>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-blue-600">
              总任务: {projectData?.total} 个
            </p>
            <p className="text-sm text-green-600">
              已完成: {projectData?.completed} 个
            </p>
            <p className="text-sm text-gray-600">
              待完成: {projectData?.pending} 个
            </p>
            <p className="text-sm text-purple-600">
              完成率: {projectData?.completionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // 如果没有数据
  if (projectsData.length === 0) {
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
      {/* 项目饼图网格 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projectsData.slice(0, 6).map((project, index) => {
          // 为每个项目生成饼图数据
          const pieData = [
            {
              name: `${project.name} - 已完成`,
              value: project.completed,
              projectName: project.name,
              type: 'completed'
            },
            {
              name: `${project.name} - 待完成`,
              value: project.pending,
              projectName: project.name,
              type: 'pending'
            }
          ].filter(item => item.value > 0); // 只显示有数值的部分

          return (
            <div key={project.name} className="rounded-lg border border-gray-200 bg-white p-4">
              {/* 项目标题 */}
              <div className="mb-3 text-center">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {project.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {project.completed}/{project.total} 已完成 ({project.completionRate.toFixed(1)}%)
                </p>
              </div>

              {/* 饼图 */}
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, pieIndex) => (
                        <Cell
                          key={`cell-${pieIndex}`}
                          fill={entry.type === 'completed' ? COMPLETION_COLORS.completed : COMPLETION_COLORS.pending}
                          stroke={entry.type === 'pending' ? '#d1d5db' : 'none'}
                          strokeWidth={entry.type === 'pending' ? 1 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 图例 */}
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">已完成</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full border border-gray-300 bg-gray-100"></div>
                  <span className="text-gray-600">待完成</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 如果项目太多，显示提示 */}
      {projectsData.length > 6 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          显示前6个项目，共{projectsData.length}个项目
        </div>
      )}

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
              {projectsData
                .sort((a, b) => b.completionRate - a.completionRate)
                .map((project, index) => (
                  <tr key={project.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <div className="mr-2 h-3 w-3 rounded-full bg-green-500"></div>
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

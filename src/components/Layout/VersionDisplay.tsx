import { useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useVersion } from "@/contexts/VersionContext";

interface VersionDisplayProps {
  collapsed?: boolean;
  position?: "sidebar" | "footer";
}

export default function VersionDisplay({
  collapsed = false,
  position = "sidebar",
}: VersionDisplayProps) {
  const { versionInfo, isLoading } = useVersion();
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading || !versionInfo) {
    return null;
  }

  const isDevelopment = versionInfo.environment === "development";
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // 侧边栏收缩状态下的显示
  if (position === "sidebar" && collapsed) {
    return (
      <div className="relative">
        <button
          className="flex w-full items-center justify-center rounded-md px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          onClick={() => setShowDetails(!showDetails)}
          title={`版本 ${versionInfo.version} (${versionInfo.environment})`}
        >
          <InformationCircleIcon className="h-4 w-4" />
        </button>

        {/* 悬浮详情 */}
        {showDetails && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg bg-white p-3 shadow-lg ring-1 ring-gray-200">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">版本:</span>
                <span className="font-medium text-gray-900">
                  {versionInfo.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">环境:</span>
                <span
                  className={`font-medium ${
                    isDevelopment ? "text-orange-600" : "text-green-600"
                  }`}
                >
                  {versionInfo.environment}
                </span>
              </div>
              {isDevelopment && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">构建:</span>
                    <span className="text-gray-700">
                      {formatDate(versionInfo.buildTime)}
                    </span>
                  </div>
                  {versionInfo.gitBranch && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">分支:</span>
                      <span className="text-gray-700">
                        {versionInfo.gitBranch}
                      </span>
                    </div>
                  )}
                  {versionInfo.gitCommit && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">提交:</span>
                      <span className="font-mono text-gray-700">
                        {versionInfo.gitCommit.substring(0, 7)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 侧边栏展开状态下的显示
  if (position === "sidebar") {
    return (
      <div className="border-t border-gray-200 px-3 py-3">
        <button
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>v{versionInfo.version}</span>
          <InformationCircleIcon className="h-4 w-4" />
        </button>

        {showDetails && (
          <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">环境:</span>
              <span
                className={`font-medium ${
                  isDevelopment ? "text-orange-600" : "text-green-600"
                }`}
              >
                {versionInfo.environment}
              </span>
            </div>
            {isDevelopment && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">构建:</span>
                  <span className="text-gray-700">
                    {formatDate(versionInfo.buildTime)}
                  </span>
                </div>
                {versionInfo.gitBranch && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">分支:</span>
                    <span className="text-gray-700">
                      {versionInfo.gitBranch}
                    </span>
                  </div>
                )}
                {versionInfo.gitCommit && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">提交:</span>
                    <span className="font-mono text-gray-700">
                      {versionInfo.gitCommit.substring(0, 7)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // 页面底部显示（移动端）
  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-center">
      <div className="text-xs text-gray-500">
        Infer GTD v{versionInfo.version}
        {isDevelopment && (
          <span className="ml-2 text-orange-600">
            ({versionInfo.environment})
          </span>
        )}
      </div>
    </div>
  );
}

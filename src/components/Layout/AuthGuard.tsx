import { type ReactNode } from "react";
import { signIn, useSession } from "next-auth/react";
import { PageLoading } from "@/components/UI";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession();

  // 加载中状态
  if (status === "loading") {
    return <PageLoading message="验证身份中..." />;
  }

  // 未认证状态
  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Infer GTD
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              智能化的个人效率和知识管理平台
            </p>
          </div>
          <div className="mt-8 space-y-6">
            <button
              onClick={() => void signIn("github")}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              使用 GitHub 登录
            </button>
            <div className="text-center text-xs text-gray-500">
              登录后即可开始使用所有功能
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已认证，渲染子组件
  return <>{children}</>;
}

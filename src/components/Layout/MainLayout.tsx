import { type ReactNode, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  HomeIcon,
  LightBulbIcon,
  ViewColumnsIcon,
  DocumentTextIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import { useSidebarState } from "@/hooks";

interface MainLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
}

const navigation: NavigationItem[] = [
  {
    name: "仪表盘",
    href: "/",
    icon: HomeIcon,
    description: "总览和快速操作",
  },
  {
    name: "思绪流",
    href: "/stream",
    icon: LightBulbIcon,
    description: "想法捕捉和快速记录",
  },
  {
    name: "任务看板",
    href: "/tasks/kanban",
    icon: ViewColumnsIcon,
    description: "可视化任务管理",
  },
  {
    name: "笔记",
    href: "/notes",
    icon: DocumentTextIcon,
    description: "知识管理和文档",
  },
  {
    name: "日志",
    href: "/journal",
    icon: BookOpenIcon,
    description: "每日反思和记录",
  },
  {
    name: "搜索",
    href: "/search",
    icon: MagnifyingGlassIcon,
    description: "全局内容搜索",
  },
  {
    name: "统计",
    href: "/analytics",
    icon: ChartBarIcon,
    description: "数据分析和洞察",
  },
];

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed, isLoaded, toggleSidebar } = useSidebarState();

  const isActivePath = (href: string) => {
    // 精确匹配路径，避免水合错误
    if (href === "/stream") {
      return router.pathname === "/stream";
    }
    if (href === "/") {
      return router.pathname === "/";
    }
    return router.pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // 使用默认展开状态防止闪烁，在客户端加载后应用实际状态
  const sidebarCollapsed = isLoaded ? isCollapsed : false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          sidebarOpen ? "block" : "hidden"
        }`}
      >
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-gray-900">Smart GTD</h1>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "lg:w-16" : "lg:w-56"
      }`}>
        <div className="flex flex-grow flex-col overflow-y-auto border-r border-gray-200 bg-white pt-5">
          <div className="flex flex-shrink-0 items-center justify-between px-4">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">Smart GTD</h1>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "展开侧边栏" : "收缩侧边栏"}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <div className="mt-5 flex flex-grow flex-col">
            <nav className="flex-1 space-y-1 px-2 pb-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                      isActive
                        ? "bg-blue-100 text-blue-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } ${sidebarCollapsed ? "justify-center" : ""}`}
                    title={sidebarCollapsed ? item.description : item.description}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${
                        isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                      } ${sidebarCollapsed ? "" : "mr-3"}`}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-56"
      }`}>
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200 lg:hidden" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="relative flex flex-1">
              {/* Global search will be implemented later */}
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User menu */}
              {sessionData?.user ? (
                <div className="flex items-center gap-x-4">
                  <div className="hidden lg:flex lg:flex-col lg:items-end lg:leading-6">
                    <div className="text-sm font-semibold text-gray-900">
                      {sessionData.user.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sessionData.user.email}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-x-2">
                      {sessionData.user.image ? (
                        <img
                          className="h-8 w-8 rounded-full bg-gray-50"
                          src={sessionData.user.image}
                          alt={sessionData.user.name ?? "User"}
                        />
                      ) : (
                        <UserCircleIcon className="h-8 w-8 text-gray-400" />
                      )}
                      <button
                        type="button"
                        className="flex items-center gap-x-1 text-sm text-gray-500 hover:text-gray-700"
                        onClick={handleSignOut}
                        title="退出登录"
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        <span className="hidden sm:block">退出</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">未登录</div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

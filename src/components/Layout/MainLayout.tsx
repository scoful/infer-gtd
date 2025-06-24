import { type ReactNode, useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  HomeIcon,
  LightBulbIcon,
  ListBulletIcon,
  BoltIcon,
  ClockIcon,
  ViewColumnsIcon,
  DocumentTextIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  TagIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

import { useSidebarState } from "@/hooks";
import { useRefresh } from "@/contexts/RefreshContext";

interface MainLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description: string;
  children?: NavigationItem[];
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
    name: "任务管理",
    href: "/tasks",
    icon: ViewColumnsIcon,
    description: "任务管理和筛选",
    children: [
      {
        name: "任务列表",
        href: "/tasks",
        icon: ListBulletIcon,
        description: "任务管理和筛选",
      },
      {
        name: "下一步行动",
        href: "/tasks/next-actions",
        icon: BoltIcon,
        description: "GTD下一步行动列表",
      },
      {
        name: "等待清单",
        href: "/tasks/waiting",
        icon: ClockIcon,
        description: "等待他人回复的任务",
      },
      {
        name: "任务看板",
        href: "/tasks/kanban",
        icon: Squares2X2Icon,
        description: "可视化任务管理",
      },
    ],
  },
  {
    name: "标签管理",
    href: "/tags",
    icon: TagIcon,
    description: "管理和组织标签",
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
    name: "统计分析",
    href: "/analytics",
    icon: ChartBarIcon,
    description: "数据分析和洞察",
    children: [
      {
        name: "数据统计",
        href: "/analytics",
        icon: ChartBarIcon,
        description: "任务和时间统计",
      },
      {
        name: "每周回顾",
        href: "/review/weekly",
        icon: CalendarIcon,
        description: "GTD每周回顾和分析",
      },
    ],
  },
];

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: sessionData } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    // 初始化时，如果当前路径是相关页面，自动展开对应菜单
    const initialExpanded = new Set<string>();
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/tasks')) {
        initialExpanded.add('任务管理');
      }
      if (window.location.pathname.startsWith('/analytics') || window.location.pathname.startsWith('/review')) {
        initialExpanded.add('统计分析');
      }
    }
    return initialExpanded;
  });
  // 收缩状态下的子菜单展开状态
  const [collapsedExpandedItems, setCollapsedExpandedItems] = useState<Set<string>>(new Set());
  const { isCollapsed, isLoaded, toggleSidebar } = useSidebarState();
  const { refreshPage } = useRefresh();

  // 监听路由变化，自动展开相关菜单
  useEffect(() => {
    if (router.pathname.startsWith('/tasks')) {
      setExpandedItems(prev => new Set(prev).add('任务管理'));
    }
    if (router.pathname.startsWith('/analytics') || router.pathname.startsWith('/review')) {
      setExpandedItems(prev => new Set(prev).add('统计分析'));
    }
  }, [router.pathname]);

  // 点击外部区域关闭收缩状态下的展开菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (collapsedExpandedItems.size > 0) {
        const target = event.target as Element;
        if (!target.closest('.collapsed-submenu-container')) {
          setCollapsedExpandedItems(new Set());
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [collapsedExpandedItems]);

  const isActivePath = (href: string) => {
    // 精确匹配路径，避免水合错误
    if (href === "/stream") {
      return router.pathname === "/stream";
    }
    if (href === "/") {
      return router.pathname === "/";
    }
    if (href === "/tasks") {
      return router.pathname === "/tasks"; // 只匹配精确路径
    }
    if (href === "/tasks/next-actions") {
      return router.pathname === "/tasks/next-actions";
    }
    if (href === "/tasks/waiting") {
      return router.pathname === "/tasks/waiting";
    }
    if (href === "/tasks/kanban") {
      return router.pathname === "/tasks/kanban";
    }
    if (href === "/tags") {
      return router.pathname === "/tags" || router.pathname.startsWith("/tags/");
    }
    if (href === "/analytics") {
      return router.pathname === "/analytics";
    }
    if (href === "/review/weekly") {
      return router.pathname === "/review/weekly";
    }
    return router.pathname.startsWith(href);
  };

  // 检查是否有子项处于激活状态
  const hasActiveChild = (item: NavigationItem) => {
    if (!item.children) return false;
    return item.children.some(child => isActivePath(child.href));
  };

  // 检查父菜单是否应该激活（当任何子页面激活时）
  const isParentActive = (item: NavigationItem) => {
    if (item.name === "任务管理") {
      return router.pathname.startsWith("/tasks");
    }
    if (item.name === "统计分析") {
      return router.pathname.startsWith("/analytics") || router.pathname.startsWith("/review");
    }
    return isActivePath(item.href);
  };

  // 切换展开状态
  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  // 切换收缩状态下的展开状态
  const toggleCollapsedExpanded = (itemName: string) => {
    setCollapsedExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // 处理导航点击
  const handleNavigationClick = (href: string, event: React.MouseEvent) => {
    const isCurrentPage = isActivePath(href);

    if (isCurrentPage) {
      // 阻止默认的链接跳转行为
      event.preventDefault();
      // 触发当前页面的数据刷新
      refreshPage(href);
    }

    // 关闭移动端侧边栏
    setSidebarOpen(false);
  };

  // 直接使用 isCollapsed 状态，Hook 已处理初始化逻辑

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
            <h1 className="text-xl font-bold text-gray-900">Infer GTD</h1>
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
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.has(item.name);
              const hasActiveChildItem = hasActiveChild(item);
              const parentActive = isParentActive(item);

              return (
                <div key={item.name}>
                  {hasChildren ? (
                    <button
                      className={`group flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium ${
                        parentActive
                          ? "bg-blue-100 text-blue-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                      onClick={() => toggleExpanded(item.name)}
                    >
                      <div className="flex items-center">
                        <Icon
                          className={`mr-3 h-5 w-5 flex-shrink-0 ${
                            parentActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                          }`}
                        />
                        {item.name}
                      </div>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-blue-100 text-blue-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                      onClick={(event) => handleNavigationClick(item.href, event)}
                    >
                      <Icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 ${
                          isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                        }`}
                      />
                      {item.name}
                    </Link>
                  )}

                  {/* 子导航项 */}
                  {hasChildren && isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = isActivePath(child.href);
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                              isChildActive
                                ? "bg-blue-100 text-blue-900"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                            onClick={(event) => handleNavigationClick(child.href, event)}
                          >
                            <ChildIcon
                              className={`mr-3 h-4 w-4 flex-shrink-0 ${
                                isChildActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                              }`}
                            />
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
        isCollapsed && collapsedExpandedItems.size === 0
          ? "lg:w-16"
          : isCollapsed && collapsedExpandedItems.size > 0
          ? "lg:w-20"
          : "lg:w-56"
      }`}>
        <div className="flex flex-grow flex-col overflow-y-auto border-r border-gray-200 bg-white pt-5">
          <div className="flex flex-shrink-0 items-center justify-between px-4">
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">Infer GTD</h1>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              onClick={toggleSidebar}
              title={isCollapsed ? "展开侧边栏" : "收缩侧边栏"}
            >
              {isCollapsed ? (
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
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedItems.has(item.name);
                const isCollapsedExpanded = collapsedExpandedItems.has(item.name);
                const hasActiveChildItem = hasActiveChild(item);
                const parentActive = isParentActive(item);

                return (
                  <div key={item.name}>
                    {hasChildren ? (
                      <div className="relative collapsed-submenu-container">
                        <button
                          className={`flex w-full items-center rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                            parentActive
                              ? "bg-blue-100 text-blue-900"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          } ${isCollapsed ? "justify-center" : "justify-between"}`}
                          title={isCollapsed ? `${item.description} (点击展开子菜单)` : item.description}
                          onClick={() => {
                            if (isCollapsed) {
                              // 在收缩状态下，点击切换子菜单展开状态
                              toggleCollapsedExpanded(item.name);
                            } else {
                              toggleExpanded(item.name);
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <Icon
                              className={`h-5 w-5 flex-shrink-0 ${
                                parentActive ? "text-blue-500" : "text-gray-400 group-hover/parent:text-gray-500"
                              } ${isCollapsed ? "" : "mr-3"}`}
                            />
                            {!isCollapsed && (
                              <span className="truncate">{item.name}</span>
                            )}
                            {/* 收缩状态下的多级菜单指示器 */}
                            {isCollapsed && (
                              <div className="absolute -right-0.5 -top-0.5 bg-blue-500 rounded-full p-0.5">
                                {isCollapsedExpanded ? (
                                  <ChevronDownIcon className="h-2.5 w-2.5 text-white" />
                                ) : (
                                  <ChevronRightIcon className="h-2.5 w-2.5 text-white" />
                                )}
                              </div>
                            )}
                          </div>
                          {!isCollapsed && (
                            isExpanded ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4" />
                            )
                          )}
                        </button>

                        {/* 子导航项 - 展开状态下显示 */}
                        {hasChildren && isExpanded && !isCollapsed && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.children!.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActivePath(child.href);
                              return (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                                    isChildActive
                                      ? "bg-blue-100 text-blue-900"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }`}
                                  title={child.description}
                                  onClick={(event) => handleNavigationClick(child.href, event)}
                                >
                                  <ChildIcon
                                    className={`mr-3 h-4 w-4 flex-shrink-0 ${
                                      isChildActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                                    }`}
                                  />
                                  {child.name}
                                </Link>
                              );
                            })}
                          </div>
                        )}

                        {/* 收缩状态下的展开子菜单 */}
                        {hasChildren && isCollapsed && isCollapsedExpanded && (
                          <div className="mt-1 space-y-0.5 border-l-2 border-blue-200 ml-2">
                            {item.children!.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActivePath(child.href);
                              return (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  className={`group flex items-center justify-center rounded-md mx-1 py-1.5 text-sm font-medium ${
                                    isChildActive
                                      ? "bg-blue-100 text-blue-900"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }`}
                                  title={child.description}
                                  onClick={(event) => {
                                    handleNavigationClick(child.href, event);
                                    // 点击后关闭展开状态
                                    setCollapsedExpandedItems(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(item.name);
                                      return newSet;
                                    });
                                  }}
                                >
                                  <ChildIcon
                                    className={`h-5 w-5 flex-shrink-0 ${
                                      isChildActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                                    }`}
                                    aria-hidden="true"
                                  />
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                          isActive
                            ? "bg-blue-100 text-blue-900"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        } ${isCollapsed ? "justify-center" : ""}`}
                        title={isCollapsed ? item.description : item.description}
                        onClick={(event) => handleNavigationClick(item.href, event)}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500"
                          } ${isCollapsed ? "" : "mr-3"}`}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isCollapsed && collapsedExpandedItems.size === 0
          ? "lg:pl-16"
          : isCollapsed && collapsedExpandedItems.size > 0
          ? "lg:pl-20"
          : "lg:pl-56"
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

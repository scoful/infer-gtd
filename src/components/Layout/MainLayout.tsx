import { type ReactNode, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  AdjustmentsHorizontalIcon,
  ArrowRightEndOnRectangleIcon,
  Bars3Icon,
  BoltIcon,
  BookmarkIcon,
  BookOpenIcon,
  CalendarIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  CogIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  LightBulbIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TagIcon,
  UserCircleIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useSidebarState } from "@/hooks";
import { useRefresh } from "@/contexts/RefreshContext";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import VersionDisplay from "./VersionDisplay";
import QuickSearch from "@/components/Search/QuickSearch";
import ShortcutHelpModal from "@/components/UI/ShortcutHelpModal";
import { api } from "@/utils/api";

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
    name: "首页",
    href: "/",
    icon: HomeIcon,
    description: "总览和快速操作",
  },
  {
    name: "任务管理",
    href: "/tasks",
    icon: ViewColumnsIcon,
    description: "任务管理和筛选",
    children: [
      {
        name: "任务看板",
        href: "/tasks/kanban",
        icon: Squares2X2Icon,
        description: "可视化任务管理",
      },
      {
        name: "任务列表",
        href: "/tasks",
        icon: ListBulletIcon,
        description: "任务管理和筛选",
      },
      {
        name: "思绪流",
        href: "/stream",
        icon: LightBulbIcon,
        description: "想法捕捉和快速记录",
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
    ],
  },
  {
    name: "项目管理",
    href: "/projects",
    icon: FolderIcon,
    description: "项目和工作领域管理",
  },
  {
    name: "标签管理",
    href: "/tags",
    icon: TagIcon,
    description: "管理和组织标签",
  },
  {
    name: "笔记管理",
    href: "/notes",
    icon: DocumentTextIcon,
    description: "知识管理和文档",
  },
  {
    name: "日记管理",
    href: "/journal",
    icon: BookOpenIcon,
    description: "每日反思和记录",
    children: [
      {
        name: "日记流",
        href: "/journal",
        icon: CalendarIcon,
        description: "日期导航和浏览",
      },
      {
        name: "日记列表",
        href: "/journal/list",
        icon: DocumentDuplicateIcon,
        description: "管理所有日记",
      },
    ],
  },
  {
    name: "搜索管理",
    href: "/search",
    icon: MagnifyingGlassIcon,
    description: "全局内容搜索",
    children: [
      {
        name: "复合搜索",
        href: "/search",
        icon: AdjustmentsHorizontalIcon,
        description: "高级搜索和筛选",
      },
      {
        name: "搜索列表",
        href: "/search/saved",
        icon: BookmarkIcon,
        description: "管理保存的搜索",
      },
    ],
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
        description: "全局数据概览和趋势分析",
      },
      {
        name: "任务回顾",
        href: "/review",
        icon: CalendarIcon,
        description: "特定时间段的深度分析",
      },
    ],
  },
  {
    name: "系统设置",
    href: "/settings",
    icon: CogIcon,
    description: "个人设置和偏好配置",
    children: [
      {
        name: "个人设置",
        href: "/settings",
        icon: CogIcon,
        description: "个性化配置和偏好设置",
      },
      {
        name: "系统管理",
        href: "/admin/scheduler",
        icon: ShieldCheckIcon,
        description: "定时任务和系统管理",
      },
    ],
  },
];

// 生成动态导航配置
function getNavigationItems(isAdmin: boolean): NavigationItem[] {
  const baseNavigation = [...navigation];

  // 如果不是管理员，移除系统管理子菜单，但保留测试页面
  if (!isAdmin) {
    const settingsIndex = baseNavigation.findIndex(
      (item) => item.name === "系统设置",
    );
    if (settingsIndex !== -1 && baseNavigation[settingsIndex]?.children) {
      baseNavigation[settingsIndex] = {
        ...baseNavigation[settingsIndex],
        children: baseNavigation[settingsIndex].children.filter(
          (child) => child.name !== "系统管理",
        ),
      };
    }
  }

  return baseNavigation;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: sessionData } = useSession();
  const router = useRouter();

  // 获取用户设置以检查管理员权限
  const { data: userSettings } = api.userSettings.get.useQuery(
    {},
    { enabled: !!sessionData?.user },
  );

  // 检查是否为管理员
  const isAdmin = userSettings?.data?.role === "admin";

  // 获取动态导航配置
  const navigationItems = getNavigationItems(isAdmin);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    // 初始化时，如果当前路径是相关页面，自动展开对应菜单
    const initialExpanded = new Set<string>();
    if (typeof window !== "undefined") {
      if (
        window.location.pathname.startsWith("/tasks") ||
        window.location.pathname === "/stream"
      ) {
        initialExpanded.add("任务管理");
      }
      if (window.location.pathname.startsWith("/journal")) {
        initialExpanded.add("日记管理");
      }
      if (window.location.pathname.startsWith("/search")) {
        initialExpanded.add("搜索管理");
      }
      if (
        window.location.pathname.startsWith("/analytics") ||
        window.location.pathname.startsWith("/review")
      ) {
        initialExpanded.add("统计分析");
      }
      if (
        window.location.pathname.startsWith("/settings") ||
        window.location.pathname.startsWith("/admin")
      ) {
        initialExpanded.add("系统设置");
      }
    }
    return initialExpanded;
  });
  // 收缩状态下的子菜单展开状态
  const [collapsedExpandedItems, setCollapsedExpandedItems] = useState<
    Set<string>
  >(new Set());
  const { isCollapsed, toggleSidebar } = useSidebarState() as {
    isCollapsed: boolean;
    toggleSidebar: () => void;
  };
  const { refreshPage } = useRefresh();

  // 初始化全局快捷键
  useGlobalShortcuts();

  // 监听路由变化，自动展开相关菜单
  useEffect(() => {
    if (router.pathname.startsWith("/tasks") || router.pathname === "/stream") {
      setExpandedItems((prev) => new Set(prev).add("任务管理"));
    }
    if (router.pathname.startsWith("/journal")) {
      setExpandedItems((prev) => new Set(prev).add("日记管理"));
    }
    if (router.pathname.startsWith("/search")) {
      setExpandedItems((prev) => new Set(prev).add("搜索管理"));
    }
    if (
      router.pathname.startsWith("/analytics") ||
      router.pathname.startsWith("/review")
    ) {
      setExpandedItems((prev) => new Set(prev).add("统计分析"));
    }
    if (
      router.pathname.startsWith("/settings") ||
      router.pathname.startsWith("/admin") ||
      router.pathname.startsWith("/test")
    ) {
      setExpandedItems((prev) => new Set(prev).add("系统设置"));
    }
  }, [router.pathname]);

  // 点击外部区域关闭收缩状态下的展开菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (collapsedExpandedItems.size > 0) {
        const target = event.target as Element;
        if (!target.closest(".collapsed-submenu-container")) {
          setCollapsedExpandedItems(new Set());
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [collapsedExpandedItems]);

  // 监听全局快捷键事件
  useEffect(() => {
    const handleGlobalShortcuts = (event: CustomEvent) => {
      switch (event.type) {
        case "global-shortcut-help":
          setShowShortcutHelp(true);
          break;
        case "global-shortcut-search":
          // 触发搜索框聚焦
          const searchInput = document.querySelector(
            'input[placeholder*="搜索"]',
          );
          if (searchInput && "focus" in searchInput) {
            (searchInput as HTMLInputElement).focus();
          }
          break;
        case "global-shortcut-new-task":
          // 全局新建任务：如果已在看板页面，触发页面内事件；否则跳转到看板页面
          if (router.pathname === "/tasks/kanban") {
            // 在看板页面，让页面内的监听器处理
            return;
          } else {
            // 不在看板页面，跳转到看板页面并打开新建模态框
            void router.push("/tasks/kanban?new=task");
          }
          break;
        case "global-shortcut-new-note":
          // 全局新建笔记：跳转到新建笔记页面
          void router.push("/notes/new");
          break;
        case "global-shortcut-new-journal":
          // 全局新建日记：跳转到新建日记页面
          void router.push("/journal/new");
          break;
      }
    };

    // 添加事件监听器
    window.addEventListener(
      "global-shortcut-help",
      handleGlobalShortcuts as EventListener,
    );
    window.addEventListener(
      "global-shortcut-search",
      handleGlobalShortcuts as EventListener,
    );
    window.addEventListener(
      "global-shortcut-new-task",
      handleGlobalShortcuts as EventListener,
    );
    window.addEventListener(
      "global-shortcut-new-note",
      handleGlobalShortcuts as EventListener,
    );
    window.addEventListener(
      "global-shortcut-new-journal",
      handleGlobalShortcuts as EventListener,
    );

    return () => {
      window.removeEventListener(
        "global-shortcut-help",
        handleGlobalShortcuts as EventListener,
      );
      window.removeEventListener(
        "global-shortcut-search",
        handleGlobalShortcuts as EventListener,
      );
      window.removeEventListener(
        "global-shortcut-new-task",
        handleGlobalShortcuts as EventListener,
      );
      window.removeEventListener(
        "global-shortcut-new-note",
        handleGlobalShortcuts as EventListener,
      );
      window.removeEventListener(
        "global-shortcut-new-journal",
        handleGlobalShortcuts as EventListener,
      );
    };
  }, [router]);

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
      return (
        router.pathname === "/tags" || router.pathname.startsWith("/tags/")
      );
    }
    if (href === "/journal") {
      return router.pathname === "/journal"; // 只匹配精确路径
    }
    if (href === "/journal/list") {
      return router.pathname === "/journal/list";
    }

    if (href === "/projects") {
      return (
        router.pathname === "/projects" ||
        router.pathname.startsWith("/projects/")
      );
    }
    if (href === "/notes") {
      return (
        router.pathname === "/notes" || router.pathname.startsWith("/notes/")
      );
    }
    if (href === "/search") {
      return router.pathname === "/search"; // 只匹配精确路径
    }
    if (href === "/search/saved") {
      return router.pathname === "/search/saved";
    }
    if (href === "/analytics") {
      return router.pathname === "/analytics";
    }
    if (href === "/review") {
      return (
        router.pathname === "/review" || router.pathname.startsWith("/review/")
      );
    }
    return router.pathname.startsWith(href);
  };

  // 检查父菜单是否应该激活（当任何子页面激活时）
  const isParentActive = (item: NavigationItem) => {
    if (item.name === "任务管理") {
      return (
        router.pathname.startsWith("/tasks") || router.pathname === "/stream"
      );
    }
    if (item.name === "日记管理") {
      return router.pathname.startsWith("/journal");
    }
    if (item.name === "搜索管理") {
      return router.pathname.startsWith("/search");
    }
    if (item.name === "统计分析") {
      return (
        router.pathname.startsWith("/analytics") ||
        router.pathname.startsWith("/review")
      );
    }
    if (item.name === "系统设置") {
      return (
        router.pathname.startsWith("/settings") ||
        router.pathname.startsWith("/admin")
      );
    }
    return isActivePath(item.href);
  };

  // 切换展开状态
  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) => {
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
    setCollapsedExpandedItems((prev) => {
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
  const handleNavigationClick = (
    href: string,
    event: React.MouseEvent,
    isChildItem = false,
  ) => {
    const isCurrentPage = isActivePath(href);

    if (isCurrentPage) {
      // 阻止默认的链接跳转行为
      event.preventDefault();
      // 触发当前页面的数据刷新
      refreshPage(href);
    } else {
      // 如果不是当前页面，执行跳转
      event.preventDefault();
      void router.push(href);
    }

    // 移动端侧边栏关闭逻辑：
    // - 如果是子导航项，不关闭侧边栏（保持展开状态以显示高亮）
    // - 只有主导航项才关闭侧边栏
    if (!isChildItem) {
      setSidebarOpen(false);
    }
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
        <div className="bg-opacity-75 fixed inset-0 bg-gray-600" />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Infer GTD</h1>
              {isAdmin && (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                  <ShieldCheckIcon className="h-3 w-3" />
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.href);
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.has(item.name);
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
                            parentActive
                              ? "text-blue-500"
                              : "text-gray-400 group-hover:text-gray-500"
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
                      onClick={(event) =>
                        handleNavigationClick(item.href, event)
                      }
                    >
                      <Icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 ${
                          isActive
                            ? "text-blue-500"
                            : "text-gray-400 group-hover:text-gray-500"
                        }`}
                      />
                      {item.name}
                    </Link>
                  )}

                  {/* 子导航项 */}
                  {hasChildren && isExpanded && (
                    <div className="mt-1 ml-6 space-y-1">
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
                            onClick={(event) =>
                              handleNavigationClick(child.href, event, true)
                            }
                          >
                            <ChildIcon
                              className={`mr-3 h-4 w-4 flex-shrink-0 ${
                                isChildActive
                                  ? "text-blue-500"
                                  : "text-gray-400 group-hover:text-gray-500"
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

          {/* 版本信息显示 */}
          <VersionDisplay position="sidebar" />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden transition-all duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:flex lg:flex-col ${
          isCollapsed && collapsedExpandedItems.size === 0
            ? "lg:w-16"
            : isCollapsed && collapsedExpandedItems.size > 0
              ? "lg:w-20"
              : "lg:w-48"
        }`}
      >
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
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.href);
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedItems.has(item.name);
                const isCollapsedExpanded = collapsedExpandedItems.has(
                  item.name,
                );
                const parentActive = isParentActive(item);

                return (
                  <div key={item.name}>
                    {hasChildren ? (
                      <div className="collapsed-submenu-container relative">
                        <button
                          className={`flex w-full items-center rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                            parentActive
                              ? "bg-blue-100 text-blue-900"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          } ${isCollapsed ? "justify-center" : "justify-between"}`}
                          title={
                            isCollapsed
                              ? `${item.description} (点击展开子菜单)`
                              : item.description
                          }
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
                                parentActive
                                  ? "text-blue-500"
                                  : "text-gray-400 group-hover/parent:text-gray-500"
                              } ${isCollapsed ? "" : "mr-3"}`}
                            />
                            {!isCollapsed && (
                              <span className="truncate">{item.name}</span>
                            )}
                            {/* 收缩状态下的多级菜单指示器 */}
                            {isCollapsed && (
                              <div className="absolute -top-0.5 -right-0.5 rounded-full bg-blue-500 p-0.5">
                                {isCollapsedExpanded ? (
                                  <ChevronDownIcon className="h-2.5 w-2.5 text-white" />
                                ) : (
                                  <ChevronRightIcon className="h-2.5 w-2.5 text-white" />
                                )}
                              </div>
                            )}
                          </div>
                          {!isCollapsed &&
                            (isExpanded ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4" />
                            ))}
                        </button>

                        {/* 子导航项 - 展开状态下显示 */}
                        {hasChildren && isExpanded && !isCollapsed && (
                          <div className="mt-1 ml-6 space-y-1">
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
                                  onClick={(event) =>
                                    handleNavigationClick(
                                      child.href,
                                      event,
                                      true,
                                    )
                                  }
                                >
                                  <ChildIcon
                                    className={`mr-3 h-4 w-4 flex-shrink-0 ${
                                      isChildActive
                                        ? "text-blue-500"
                                        : "text-gray-400 group-hover:text-gray-500"
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
                          <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-blue-200">
                            {item.children!.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = isActivePath(child.href);
                              return (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  className={`group mx-1 flex items-center justify-center rounded-md py-1.5 text-sm font-medium ${
                                    isChildActive
                                      ? "bg-blue-100 text-blue-900"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }`}
                                  title={child.description}
                                  onClick={(event) => {
                                    handleNavigationClick(
                                      child.href,
                                      event,
                                      true,
                                    );
                                    // 点击后关闭展开状态
                                    setCollapsedExpandedItems((prev) => {
                                      const newSet = new Set(prev);
                                      newSet.delete(item.name);
                                      return newSet;
                                    });
                                  }}
                                >
                                  <ChildIcon
                                    className={`h-5 w-5 flex-shrink-0 ${
                                      isChildActive
                                        ? "text-blue-500"
                                        : "text-gray-400 group-hover:text-gray-500"
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
                        title={
                          isCollapsed ? item.description : item.description
                        }
                        onClick={(event) =>
                          handleNavigationClick(item.href, event)
                        }
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            isActive
                              ? "text-blue-500"
                              : "text-gray-400 group-hover:text-gray-500"
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

            {/* 版本信息显示 */}
            <VersionDisplay collapsed={isCollapsed} position="sidebar" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed && collapsedExpandedItems.size === 0
            ? "lg:pl-16"
            : isCollapsed && collapsedExpandedItems.size > 0
              ? "lg:pl-20"
              : "lg:pl-48"
        }`}
      >
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
            <div className="relative flex flex-1 items-center">
              {/* 全局快速搜索 */}
              <div className="w-full max-w-lg">
                <QuickSearch className="w-full" />
              </div>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User menu */}
              {sessionData?.user ? (
                <div className="flex items-center gap-x-4">
                  <div className="hidden lg:flex lg:flex-col lg:items-end lg:leading-6">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {sessionData.user.name}
                      </div>
                      {isAdmin && (
                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <ShieldCheckIcon className="mr-1 h-3 w-3" />
                          管理员
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sessionData.user.email}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-x-2">
                      {sessionData.user.image ? (
                        <Image
                          className="h-8 w-8 rounded-full bg-gray-50"
                          src={sessionData.user.image}
                          alt={sessionData.user.name ?? "User"}
                          width={32}
                          height={32}
                          unoptimized
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
                        <ArrowRightEndOnRectangleIcon className="h-4 w-4" />
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

        {/* 移动端版本信息显示 */}
        <div className="lg:hidden">
          <VersionDisplay position="footer" />
        </div>
      </div>

      {/* 快捷键帮助模态框 */}
      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />
    </div>
  );
}

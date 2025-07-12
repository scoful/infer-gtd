/**
 * 用户设置页面
 * 
 * 功能：
 * 1. 日记自动生成设置
 * 2. 通知设置
 * 3. 界面设置
 */

import { useState } from "react";
import Head from "next/head";
import {
  CogIcon,
  BookOpenIcon,
  BellIcon,
  PaintBrushIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { useConfirm } from "@/hooks/useConfirm";
import { ConfirmModal } from "@/components/UI";
import type { UserSettings } from "@/server/api/schemas/user-settings";

function SettingsPage() {
  const { showSuccess, showError } = useGlobalNotifications();
  const { confirmState, showConfirm, hideConfirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<"journal" | "notifications" | "ui">("journal");

  // 获取用户设置
  const { data: userSettings, refetch } = api.userSettings.get.useQuery({});

  // 更新用户设置
  const updateSettings = api.userSettings.update.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void refetch();
    },
    onError: (error) => {
      showError(error.message || "更新设置失败");
    },
  });

  // 重置设置
  const resetSettings = api.userSettings.reset.useMutation({
    onSuccess: (result) => {
      showSuccess(result.message);
      void refetch();
    },
    onError: (error) => {
      showError(error.message || "重置设置失败");
    },
  });

  const settings = userSettings?.data;

  // 处理设置更新
  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    // 确保保留当前的role字段
    const settingsWithRole = {
      ...newSettings,
      role: settings?.role || "user", // 保留现有role或默认为user
    };
    updateSettings.mutate({ settings: settingsWithRole });
  };

  // 处理重置设置
  const handleResetSettings = async () => {
    const confirmed = await showConfirm({
      title: "重置设置",
      message: "确定要重置所有设置为默认值吗？\n\n此操作不可撤销，但会保留您的管理员权限。",
      confirmText: "重置",
      cancelText: "取消",
      type: "warning",
    });

    if (confirmed) {
      resetSettings.mutate();
    }
  };

  const tabs = [
    { id: "journal", name: "日记自动生成", icon: BookOpenIcon },
    { id: "notifications", name: "通知设置", icon: BellIcon },
    { id: "ui", name: "界面设置", icon: PaintBrushIcon },
  ] as const;

  return (
    <>
      <Head>
        <title>用户设置 | Smart GTD</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <CogIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">用户设置</h1>
          </div>
          <p className="mt-2 text-gray-600">
            个性化配置您的 GTD 系统体验
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* 侧边栏导航 */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 设置内容 */}
          <div className="flex-1 mt-6 lg:mt-0">
            <div className="bg-white rounded-lg border border-gray-200">
              {/* 日记自动生成设置 */}
              {activeTab === "journal" && (
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <BookOpenIcon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">日记自动生成</h2>
                  </div>

                  <div className="space-y-6">
                    {/* 启用自动生成 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">启用自动生成</h3>
                        <p className="text-sm text-gray-500">
                          自动根据完成的任务生成日记内容
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings?.autoJournalGeneration?.enabled ?? true}
                          onChange={(e) =>
                            handleUpdateSettings({
                              autoJournalGeneration: {
                                ...settings?.autoJournalGeneration,
                                enabled: e.target.checked,
                              },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* 任务完成时触发 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">任务完成时自动更新</h3>
                        <p className="text-sm text-gray-500">
                          完成任务时自动将任务添加到当天日记
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings?.autoJournalGeneration?.onTaskComplete ?? true}
                          onChange={(e) =>
                            handleUpdateSettings({
                              autoJournalGeneration: {
                                ...settings?.autoJournalGeneration,
                                onTaskComplete: e.target.checked,
                              },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* 每日定时生成 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">每日定时生成</h3>
                        <p className="text-sm text-gray-500">
                          每天定时自动生成日记（默认23:55）
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings?.autoJournalGeneration?.dailySchedule ?? true}
                          onChange={(e) =>
                            handleUpdateSettings({
                              autoJournalGeneration: {
                                ...settings?.autoJournalGeneration,
                                dailySchedule: e.target.checked,
                              },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* 定时生成时间 */}
                    {settings?.autoJournalGeneration?.dailySchedule && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          定时生成时间
                        </label>
                        <div className="flex items-center space-x-2">
                          <ClockIcon className="h-5 w-5 text-gray-400" />
                          <input
                            type="time"
                            value={settings?.autoJournalGeneration?.scheduleTime ?? "23:55"}
                            onChange={(e) =>
                              handleUpdateSettings({
                                autoJournalGeneration: {
                                  ...settings?.autoJournalGeneration,
                                  scheduleTime: e.target.value,
                                },
                              })
                            }
                            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* 包含信息选项 */}
                    <div className="border-t pt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">包含信息</h3>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings?.autoJournalGeneration?.includeTimeSpent ?? true}
                            onChange={(e) =>
                              handleUpdateSettings({
                                autoJournalGeneration: {
                                  ...settings?.autoJournalGeneration,
                                  includeTimeSpent: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">用时信息</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings?.autoJournalGeneration?.includeProject ?? true}
                            onChange={(e) =>
                              handleUpdateSettings({
                                autoJournalGeneration: {
                                  ...settings?.autoJournalGeneration,
                                  includeProject: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">项目信息</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings?.autoJournalGeneration?.includeTags ?? true}
                            onChange={(e) =>
                              handleUpdateSettings({
                                autoJournalGeneration: {
                                  ...settings?.autoJournalGeneration,
                                  includeTags: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">标签信息</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 管理员专用设置 */}
                  {settings?.role === "admin" && (
                    <div className="border-t pt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">管理员设置</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="text-sm font-medium text-blue-800">
                            您拥有管理员权限
                          </span>
                        </div>
                        <p className="text-sm text-blue-700 mt-1">
                          可以访问系统管理功能，包括定时任务管理等
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 通知设置 */}
              {activeTab === "notifications" && (
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <BellIcon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">通知设置</h2>
                  </div>
                  <p className="text-gray-500">通知功能正在开发中...</p>
                </div>
              )}

              {/* 界面设置 */}
              {activeTab === "ui" && (
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <PaintBrushIcon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">界面设置</h2>
                  </div>
                  <p className="text-gray-500">界面设置功能正在开发中...</p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="flex justify-between">
                  <button
                    onClick={handleResetSettings}
                    disabled={resetSettings.isPending}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    重置为默认值
                  </button>
                  
                  <div className="text-sm text-gray-500">
                    设置会自动保存
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 确认模态框 */}
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={hideConfirm}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          type={confirmState.type}
          isLoading={confirmState.isLoading}
        />
      </div>
    </>
  );
}

export default function SettingsPageWithLayout() {
  return (
    <AuthGuard>
      <MainLayout>
        <SettingsPage />
      </MainLayout>
    </AuthGuard>
  );
}

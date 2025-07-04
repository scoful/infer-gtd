import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null; // 编辑模式的项目ID
  onSuccess?: () => void;
}

interface ProjectFormData {
  name: string;
  description: string;
  color: string;
}

// 预定义颜色选项
const COLOR_OPTIONS = [
  { name: "蓝色", value: "#3B82F6" },
  { name: "绿色", value: "#10B981" },
  { name: "紫色", value: "#8B5CF6" },
  { name: "红色", value: "#EF4444" },
  { name: "黄色", value: "#F59E0B" },
  { name: "粉色", value: "#EC4899" },
  { name: "青色", value: "#06B6D4" },
  { name: "橙色", value: "#F97316" },
  { name: "灰色", value: "#6B7280" },
];

export default function ProjectModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: ProjectModalProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    description: "",
    color: COLOR_OPTIONS[0]?.value || "#3B82F6",
  });

  const isEditing = !!projectId;
  const { showSuccess, showError } = useGlobalNotifications();

  // 获取项目详情（编辑模式）
  const {
    data: projectDetail,
    isLoading: isLoadingProject,
    error: projectError,
  } = api.project.getById.useQuery(
    { id: projectId! },
    {
      enabled: isOpen && isEditing,
      refetchOnMount: true,
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  );

  // 创建项目 mutation
  const createProject = api.project.create.useMutation({
    onSuccess: () => {
      showSuccess("项目创建成功");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(`创建失败: ${error.message}`);
    },
  });

  // 更新项目 mutation
  const updateProject = api.project.update.useMutation({
    onSuccess: () => {
      showSuccess("项目更新成功");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      showError(`更新失败: ${error.message}`);
    },
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: COLOR_OPTIONS[0]?.value || "#3B82F6",
    });
  };

  // 当项目详情加载完成时，填充表单
  useEffect(() => {
    if (projectDetail && isEditing) {
      setFormData({
        name: projectDetail.name,
        description: projectDetail.description || "",
        color: projectDetail.color || COLOR_OPTIONS[0]?.value || "#3B82F6",
      });
    }
  }, [projectDetail, isEditing]);

  // 当模态框关闭时重置表单
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError("请输入项目名称");
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
      };

      if (isEditing) {
        await updateProject.mutateAsync({
          id: projectId,
          ...submitData,
        });
      } else {
        await createProject.mutateAsync(submitData);
      }
    } catch (error) {
      console.error("保存项目失败:", error);
    }
  };

  const handleClose = () => {
    if (createProject.isPending || updateProject.isPending) return;
    onClose();
  };

  const isLoading = createProject.isPending || updateProject.isPending;
  const isFormLoading = isLoadingProject && isEditing;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-opacity-25 fixed inset-0 bg-black" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* 标题栏 */}
                <div className="flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900"
                  >
                    {isEditing ? "编辑项目" : "新建项目"}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* 表单内容 */}
                {isFormLoading ? (
                  <div className="mt-4 flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-600">
                      加载项目信息...
                    </span>
                  </div>
                ) : projectError && isEditing ? (
                  <div className="mt-4 rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-600">
                      加载项目信息失败: {projectError.message}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {/* 项目名称 */}
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700"
                      >
                        项目名称 *
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        placeholder="输入项目名称"
                        maxLength={100}
                        required
                      />
                    </div>

                    {/* 项目描述 */}
                    <div>
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700"
                      >
                        项目描述
                      </label>
                      <textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        placeholder="输入项目描述（可选）"
                        maxLength={500}
                      />
                    </div>

                    {/* 项目颜色 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        项目颜色
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, color: color.value })
                            }
                            className={`h-8 w-8 rounded-full border-2 transition-all ${
                              formData.color === color.value
                                ? "scale-110 border-gray-900"
                                : "border-gray-300 hover:border-gray-400"
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading || !formData.name.trim()}
                        className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                      >
                        {isLoading && (
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        )}
                        {isEditing ? "更新" : "创建"}
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

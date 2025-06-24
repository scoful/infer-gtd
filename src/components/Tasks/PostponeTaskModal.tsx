import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { api } from "@/utils/api";
import { useGlobalNotifications } from "@/components/Layout/NotificationProvider";

interface PostponeTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  currentDueDate?: Date | null;
  currentDueTime?: string | null;
  onSuccess?: () => void;
}

export default function PostponeTaskModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  currentDueDate,
  currentDueTime,
  onSuccess,
}: PostponeTaskModalProps) {
  const { showSuccess, showError } = useGlobalNotifications();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [selectedQuickOption, setSelectedQuickOption] = useState<number | null>(
    null,
  );

  // 快捷时间调整选项（支持延期和提前）
  const quickOptions = [
    { label: "提前1天", days: -1 },
    { label: "提前3小时", hours: -3 },
    { label: "提前1小时", hours: -1 },
    { label: "延期1小时", hours: 1 },
    { label: "延期3小时", hours: 3 },
    { label: "延期1天", days: 1 },
    { label: "延期3天", days: 3 },
    { label: "延期1周", days: 7 },
  ];

  // 延期任务 mutation
  const postponeTask = api.task.postponeTask.useMutation({
    onSuccess: (data) => {
      showSuccess(data.message);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      showError(error.message || "延期任务失败");
    },
  });

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (currentDueDate) {
        // 默认延期1小时
        const defaultPostponeDate = new Date(currentDueDate);
        if (currentDueTime) {
          const [hours, minutes] = currentDueTime.split(":");
          defaultPostponeDate.setHours(
            parseInt(hours || "0"),
            parseInt(minutes || "0"),
            0,
            0,
          );
        } else {
          // 没有具体时间，设置为当天23:59
          defaultPostponeDate.setHours(23, 59, 0, 0);
        }
        // 延期1小时
        defaultPostponeDate.setHours(defaultPostponeDate.getHours() + 1);
        setSelectedDate(defaultPostponeDate.toISOString().split("T")[0] || "");

        const newHours = defaultPostponeDate
          .getHours()
          .toString()
          .padStart(2, "0");
        const newMinutes = defaultPostponeDate
          .getMinutes()
          .toString()
          .padStart(2, "0");
        setSelectedTime(`${newHours}:${newMinutes}`);
      } else {
        // 如果没有当前截止时间，默认设置为1小时后
        const oneHourLater = new Date();
        oneHourLater.setHours(oneHourLater.getHours() + 1);
        setSelectedDate(oneHourLater.toISOString().split("T")[0] || "");

        const hours = oneHourLater.getHours().toString().padStart(2, "0");
        const minutes = oneHourLater.getMinutes().toString().padStart(2, "0");
        setSelectedTime(`${hours}:${minutes}`);
      }

      // 设置默认选中"延期1小时"选项（索引为3）
      setSelectedQuickOption(3);
      setNote("");
    }
  }, [isOpen, currentDueDate, currentDueTime]);

  // 处理快捷时间调整（支持延期和提前）
  const handleQuickPostpone = (
    option: { hours?: number; days?: number },
    optionIndex: number,
  ) => {
    // 以当前截止时间为基点计算调整后的时间
    let baseTime: Date;

    if (currentDueDate) {
      baseTime = new Date(currentDueDate);
      // 如果有具体时间，设置到baseTime
      if (currentDueTime) {
        const [hours, minutes] = currentDueTime.split(":");
        baseTime.setHours(
          parseInt(hours || "0"),
          parseInt(minutes || "0"),
          0,
          0,
        );
      } else {
        // 没有具体时间，设置为当天23:59
        baseTime.setHours(23, 59, 0, 0);
      }
    } else {
      // 如果没有当前截止时间，使用当前时间作为基点
      baseTime = new Date();
    }

    // 支持正数（延期）和负数（提前）
    if (option.hours) {
      baseTime.setHours(baseTime.getHours() + option.hours);
    } else if (option.days) {
      baseTime.setDate(baseTime.getDate() + option.days);
    }

    // 检查调整后的时间是否在过去（仅对提前操作进行提醒）
    const now = new Date();
    if (
      baseTime < now &&
      ((option.hours && option.hours < 0) || (option.days && option.days < 0))
    ) {
      // 如果提前后的时间在过去，给出提示但仍允许设置
      console.warn("调整后的时间在过去，请确认是否正确");
    }

    setSelectedDate(baseTime.toISOString().split("T")[0] || "");
    const hours = baseTime.getHours().toString().padStart(2, "0");
    const minutes = baseTime.getMinutes().toString().padStart(2, "0");
    setSelectedTime(`${hours}:${minutes}`);

    // 设置选中的快捷选项
    setSelectedQuickOption(optionIndex);
  };

  // 处理手动修改日期/时间时清除快捷选项选中状态
  const handleManualDateChange = (value: string) => {
    setSelectedDate(value);
    setSelectedQuickOption(null);
  };

  const handleManualTimeChange = (value: string) => {
    setSelectedTime(value);
    setSelectedQuickOption(null);
  };

  // 处理提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      showError("请选择调整日期");
      return;
    }

    const dueDate = new Date(selectedDate);

    postponeTask.mutate({
      id: taskId,
      dueDate,
      dueTime: selectedTime || undefined,
      note: note || undefined,
    });
  };

  // 格式化当前截止时间显示
  const formatCurrentDueDate = () => {
    if (!currentDueDate) return "未设置截止时间";

    const dateStr = currentDueDate.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return `${dateStr}${currentDueTime ? ` ${currentDueTime}` : " 全天"}`;
  };

  // 格式化延期后时间显示
  const formatNewDueDate = () => {
    if (!selectedDate) return "";

    const newDate = new Date(selectedDate);
    const dateStr = newDate.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return `${dateStr}${selectedTime ? ` ${selectedTime}` : " 全天"}`;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                <div className="mb-4 flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900"
                  >
                    调整任务时间
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* 任务信息 */}
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <h4 className="mb-2 font-medium text-gray-900">
                    {taskTitle}
                  </h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      当前截止时间：{formatCurrentDueDate()}
                    </p>
                    {selectedDate && (
                      <p className="text-sm text-blue-600">
                        调整至：{formatNewDueDate()}
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 快捷时间调整选项 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      快捷时间调整
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {quickOptions.map((option, index) => {
                        const isAdvance =
                          (option.hours && option.hours < 0) ||
                          (option.days && option.days < 0);
                        const isSelected = selectedQuickOption === index;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleQuickPostpone(option, index)}
                            className={`rounded-md border px-3 py-2 text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                              isSelected
                                ? isAdvance
                                  ? "border-orange-500 bg-orange-100 text-orange-800 shadow-sm"
                                  : "border-blue-500 bg-blue-100 text-blue-800 shadow-sm"
                                : isAdvance
                                  ? "border-orange-300 text-orange-700 hover:bg-orange-50"
                                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 自定义日期 */}
                  <div>
                    <label
                      htmlFor="dueDate"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      调整至日期 *
                    </label>
                    <input
                      type="date"
                      id="dueDate"
                      value={selectedDate}
                      onChange={(e) => handleManualDateChange(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* 自定义时间 */}
                  <div>
                    <label
                      htmlFor="dueTime"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      调整至时间（可选）
                    </label>
                    <input
                      type="time"
                      id="dueTime"
                      value={selectedTime}
                      onChange={(e) => handleManualTimeChange(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* 延期备注 */}
                  <div>
                    <label
                      htmlFor="note"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      调整原因（可选）
                    </label>
                    <textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="记录时间调整的原因..."
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {note.length}/500
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={postponeTask.isPending || !selectedDate}
                      className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {postponeTask.isPending ? "调整中..." : "确认调整"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

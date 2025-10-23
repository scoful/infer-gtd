import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import { GLOBAL_SHORTCUTS, getShortcutText } from "@/hooks/useGlobalShortcuts";

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutHelpModal({
  isOpen,
  onClose,
}: ShortcutHelpModalProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        navigator.platform.toUpperCase().includes("MAC"),
    );
  }, []);

  // 快捷键分组
  const shortcutGroups = [
    {
      title: "导航",
      shortcuts: [{ ...GLOBAL_SHORTCUTS.SEARCH }],
    },
    {
      title: "新建",
      shortcuts: [
        { ...GLOBAL_SHORTCUTS.NEW_TASK },
        { ...GLOBAL_SHORTCUTS.NEW_NOTE },
        { ...GLOBAL_SHORTCUTS.NEW_JOURNAL },
      ],
    },
    {
      title: "快速操作",
      shortcuts: [
        { ...GLOBAL_SHORTCUTS.QUICK_CAPTURE },
        { ...GLOBAL_SHORTCUTS.TODAY_JOURNAL },
        { ...GLOBAL_SHORTCUTS.HELP },
      ],
    },
  ];

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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <CommandLineIcon className="mr-2 h-6 w-6 text-blue-600" />
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      快捷键帮助
                    </Dialog.Title>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">关闭</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-6">
                  {shortcutGroups.map((group) => (
                    <div key={group.title}>
                      <h4 className="mb-3 text-sm font-medium text-gray-900">
                        {group.title}
                      </h4>
                      <div className="space-y-2">
                        {group.shortcuts.map((shortcut) => (
                          <div
                            key={shortcut.key}
                            className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50"
                          >
                            <span className="text-sm text-gray-700">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center space-x-1">
                              {shortcut.ctrlKey || shortcut.metaKey ? (
                                <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                  {isMac ? "⌘" : "Ctrl"}
                                </kbd>
                              ) : null}
                              {"altKey" in shortcut && shortcut.altKey ? (
                                <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                  Alt
                                </kbd>
                              ) : null}
                              {"shiftKey" in shortcut && shortcut.shiftKey ? (
                                <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                  Shift
                                </kbd>
                              ) : null}
                              <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                {shortcut.key.toUpperCase()}
                              </kbd>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="rounded-md bg-blue-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CommandLineIcon
                          className="h-5 w-5 text-blue-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          提示
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <ul className="list-inside list-disc space-y-1">
                            <li>
                              快捷键在输入框中通常不会触发（搜索和帮助除外）
                            </li>
                            <li>
                              在 Mac 上使用 ⌘ 键，在 Windows/Linux 上使用 Ctrl
                              键
                            </li>
                            <li>
                              按 {isMac ? "⌘" : "Ctrl"} + Alt + H 随时打开此帮助
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    知道了
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

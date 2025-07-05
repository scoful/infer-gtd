import { useCallback, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

export interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    isLoading: false,
    title: "",
    message: "",
    confirmText: "确认",
    cancelText: "取消",
    type: "danger",
    onConfirm: () => {
      // Default empty function
    },
  });

  const showConfirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          isLoading: false,
          title: options.title,
          message: options.message,
          confirmText: options.confirmText ?? "确认",
          cancelText: options.cancelText ?? "取消",
          type: options.type ?? "danger",
          onConfirm: () => {
            resolve(true);
            setConfirmState((prev) => ({ ...prev, isOpen: false }));
          },
        });

        // 添加取消处理，确保Promise总是会resolve
        const handleCancel = () => {
          resolve(false);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        };

        // 存储取消处理函数，以便在hideConfirm中使用
        setConfirmState((prev) => ({ ...prev, onCancel: handleCancel }));
      });
    },
    [],
  );

  const hideConfirm = useCallback(() => {
    setConfirmState((prev) => {
      // 如果有onCancel函数，调用它
      if (prev.onCancel) {
        prev.onCancel();
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setConfirmState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  return {
    confirmState,
    showConfirm,
    hideConfirm,
    setLoading,
  };
}

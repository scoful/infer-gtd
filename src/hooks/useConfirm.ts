import { useState, useCallback } from "react";

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
    onConfirm: () => {},
  });

  const showConfirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          isLoading: false,
          title: options.title,
          message: options.message,
          confirmText: options.confirmText || "确认",
          cancelText: options.cancelText || "取消",
          type: options.type || "danger",
          onConfirm: () => {
            resolve(true);
            setConfirmState((prev) => ({ ...prev, isOpen: false }));
          },
        });
      });
    },
    [],
  );

  const hideConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
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

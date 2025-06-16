import { useState, useCallback, useRef } from "react";
import { type NotificationData, type NotificationType } from "@/components/UI/Notification";

interface ShowNotificationOptions {
  title?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = () => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // 清除定时器
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    options: ShowNotificationOptions = {}
  ) => {
    const id = generateId();
    const duration = options.duration ?? (type === "error" ? 5000 : 3000);
    
    const notification: NotificationData = {
      id,
      type,
      message,
      title: options.title,
      duration,
      persistent: options.persistent,
      action: options.action,
    };

    setNotifications(prev => [...prev, notification]);

    // 如果不是持久化通知，设置自动移除
    if (!options.persistent) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, duration);
      
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [removeNotification]);

  // 便捷方法
  const showSuccess = useCallback((message: string, options?: ShowNotificationOptions) => {
    return showNotification("success", message, options);
  }, [showNotification]);

  const showError = useCallback((message: string, options?: ShowNotificationOptions) => {
    return showNotification("error", message, options);
  }, [showNotification]);

  const showWarning = useCallback((message: string, options?: ShowNotificationOptions) => {
    return showNotification("warning", message, options);
  }, [showNotification]);

  const showInfo = useCallback((message: string, options?: ShowNotificationOptions) => {
    return showNotification("info", message, options);
  }, [showNotification]);

  const clearAll = useCallback(() => {
    // 清除所有定时器
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
    
    setNotifications([]);
  }, []);

  const clearByType = useCallback((type: NotificationType) => {
    setNotifications(prev => {
      const toRemove = prev.filter(n => n.type === type);
      toRemove.forEach(n => {
        const timeout = timeoutRefs.current.get(n.id);
        if (timeout) {
          clearTimeout(timeout);
          timeoutRefs.current.delete(n.id);
        }
      });
      
      return prev.filter(n => n.type !== type);
    });
  }, []);

  return {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAll,
    clearByType,
  };
}

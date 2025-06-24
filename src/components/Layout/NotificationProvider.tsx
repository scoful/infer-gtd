import React, { createContext, useContext, type ReactNode } from "react";
import { NotificationContainer } from "@/components/UI";
import { useNotifications } from "@/hooks";
import type { NotificationType } from "@/components/UI/Notification";

interface ShowNotificationOptions {
  title?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  showNotification: (
    type: NotificationType,
    message: string,
    options?: ShowNotificationOptions,
  ) => string;
  showSuccess: (message: string, options?: ShowNotificationOptions) => string;
  showError: (message: string, options?: ShowNotificationOptions) => string;
  showWarning: (message: string, options?: ShowNotificationOptions) => string;
  showInfo: (message: string, options?: ShowNotificationOptions) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearByType: (type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
  position?:
    | "top-right"
    | "top-center"
    | "top-left"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left";
}

export function NotificationProvider({
  children,
  position = "top-center",
}: NotificationProviderProps) {
  const notificationHook = useNotifications();

  return (
    <NotificationContext.Provider value={notificationHook}>
      {children}
      <NotificationContainer
        notifications={notificationHook.notifications}
        onClose={notificationHook.removeNotification}
        position={position}
      />
    </NotificationContext.Provider>
  );
}

export function useGlobalNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useGlobalNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}

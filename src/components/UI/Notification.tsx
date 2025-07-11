import React from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationData {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationProps {
  notification: NotificationData;
  onClose: (id: string) => void;
}

const notificationStyles = {
  success: {
    container: "bg-green-500/95 text-white border border-green-400/20",
    icon: CheckCircleIcon,
    iconColor: "text-green-200",
  },
  error: {
    container: "bg-red-500/95 text-white border border-red-400/20",
    icon: XCircleIcon,
    iconColor: "text-red-200",
  },
  warning: {
    container: "bg-orange-500/95 text-white border border-orange-400/20",
    icon: ExclamationTriangleIcon,
    iconColor: "text-orange-200",
  },
  info: {
    container: "bg-blue-500/95 text-white border border-blue-400/20",
    icon: InformationCircleIcon,
    iconColor: "text-blue-200",
  },
};

export function Notification({ notification, onClose }: NotificationProps) {
  const style = notificationStyles[notification.type];
  const Icon = style.icon;

  return (
    <div
      className={`rounded-lg px-6 py-4 shadow-xl backdrop-blur-sm transition-all duration-300 ${style.container} max-w-md`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${style.iconColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          {notification.title && (
            <h4 className="mb-1 text-sm font-semibold">{notification.title}</h4>
          )}
          <p className="text-sm">{notification.message}</p>

          {notification.action && (
            <button
              type="button"
              onClick={notification.action.onClick}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onClose(notification.id)}
          className="flex-shrink-0 text-white/70 hover:text-white"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: NotificationData[];
  onClose: (id: string) => void;
  position?:
    | "top-right"
    | "top-center"
    | "top-left"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left";
}

const positionStyles = {
  "top-right": "fixed top-6 right-6 z-[60]",
  "top-center": "fixed top-6 left-1/2 transform -translate-x-1/2 z-[60]",
  "top-left": "fixed top-6 left-6 z-[60]",
  "bottom-right": "fixed bottom-6 right-6 z-[60]",
  "bottom-center": "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[60]",
  "bottom-left": "fixed bottom-6 left-6 z-[60]",
};

export function NotificationContainer({
  notifications,
  onClose,
  position = "top-center",
}: NotificationContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className={`${positionStyles[position]} space-y-3`}>
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

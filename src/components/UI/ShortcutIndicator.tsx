import { useEffect, useState } from "react";
import { getShortcutText } from "@/hooks/useGlobalShortcuts";

interface ShortcutIndicatorProps {
  shortcut: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function ShortcutIndicator({
  shortcut,
  className = "",
  size = "sm",
}: ShortcutIndicatorProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        navigator.platform.toUpperCase().includes("MAC"),
    );
  }, []);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-2.5 py-1.5",
  };

  const renderKeys = () => {
    const keys: string[] = [];

    if (shortcut.ctrlKey || shortcut.metaKey) {
      keys.push(isMac ? "⌘" : "Ctrl");
    }

    if (shortcut.altKey) {
      keys.push(isMac ? "⌥" : "Alt");
    }

    if (shortcut.shiftKey) {
      keys.push("Shift");
    }

    if (shortcut.key) {
      keys.push(shortcut.key.toUpperCase());
    }

    return keys.map((key, index) => (
      <span key={key}>
        <kbd
          className={`inline-flex items-center rounded border border-gray-200 bg-gray-100 font-medium text-gray-700 ${sizeClasses[size]}`}
        >
          {key}
        </kbd>
        {index < keys.length - 1 && (
          <span className="mx-1 text-gray-400">+</span>
        )}
      </span>
    ));
  };

  return <div className={`flex items-center ${className}`}>{renderKeys()}</div>;
}

// 快捷键提示气泡组件
interface ShortcutTooltipProps {
  shortcut: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    description: string;
  };
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function ShortcutTooltip({
  shortcut,
  children,
  position = "top",
}: ShortcutTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        navigator.platform.toUpperCase().includes("MAC"),
    );
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900",
    bottom:
      "bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900",
    left: "left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900",
    right:
      "right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900",
  };

  const getShortcutKeys = () => {
    const keys: string[] = [];

    if (shortcut.ctrlKey || shortcut.metaKey) {
      keys.push(isMac ? "⌘" : "Ctrl");
    }

    if (shortcut.altKey) {
      keys.push(isMac ? "⌥" : "Alt");
    }

    if (shortcut.shiftKey) {
      keys.push("Shift");
    }

    if (shortcut.key) {
      keys.push(shortcut.key.toUpperCase());
    }

    return keys.join(" + ");
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="rounded bg-gray-900 px-3 py-2 text-xs whitespace-nowrap text-white">
            <div className="font-medium">{shortcut.description}</div>
            <div className="mt-1 text-gray-300">{getShortcutKeys()}</div>
          </div>
          <div
            className={`absolute h-0 w-0 border-4 ${arrowClasses[position]}`}
          ></div>
        </div>
      )}
    </div>
  );
}

// 快捷键徽章组件（用于按钮等）
interface ShortcutBadgeProps {
  shortcut: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  };
  className?: string;
}

export function ShortcutBadge({
  shortcut,
  className = "",
}: ShortcutBadgeProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        navigator.platform.toUpperCase().includes("MAC"),
    );
  }, []);

  const getShortcutText = () => {
    const keys: string[] = [];

    if (shortcut.ctrlKey || shortcut.metaKey) {
      keys.push(isMac ? "⌘" : "Ctrl");
    }

    if (shortcut.altKey) {
      keys.push(isMac ? "⌥" : "Alt");
    }

    if (shortcut.shiftKey) {
      keys.push("⇧");
    }

    if (shortcut.key) {
      keys.push(shortcut.key.toUpperCase());
    }

    return keys.join("");
  };

  return (
    <span
      className={`inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ${className}`}
    >
      {getShortcutText()}
    </span>
  );
}

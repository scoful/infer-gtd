import React from "react";
import { type ReactNode } from "react";
import { type TRPCClientError } from "@trpc/client";
import { type AppRouter } from "@/server/api/root";

// 基础Loading Spinner组件
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "blue" | "gray" | "white";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  color = "blue",
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  const colorClasses = {
    blue: "border-blue-600 border-r-transparent",
    gray: "border-gray-600 border-r-transparent",
    white: "border-white border-r-transparent",
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-4 border-solid ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="加载中"
    >
      <span className="sr-only">加载中...</span>
    </div>
  );
}

// Loading文字组件
interface LoadingTextProps {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  color?: "gray" | "blue" | "white";
  className?: string;
}

export function LoadingText({
  children = "加载中...",
  size = "md",
  color = "gray",
  className = "",
}: LoadingTextProps) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClasses = {
    gray: "text-gray-600",
    blue: "text-blue-600",
    white: "text-white",
  };

  return (
    <p className={`${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      {children}
    </p>
  );
}

// Loading容器组件
interface LoadingContainerProps {
  children: ReactNode;
  center?: boolean;
  fullHeight?: boolean;
  className?: string;
}

export function LoadingContainer({
  children,
  center = true,
  fullHeight = false,
  className = "",
}: LoadingContainerProps) {
  const centerClasses = center ? "flex items-center justify-center" : "";
  const heightClasses = fullHeight ? "min-h-screen" : "h-64";

  return (
    <div className={`${centerClasses} ${heightClasses} ${className}`}>
      <div className="text-center">{children}</div>
    </div>
  );
}

// 页面级Loading组件
interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({
  message = "加载中...",
  className = "",
}: PageLoadingProps) {
  return (
    <LoadingContainer fullHeight className={`bg-gray-50 ${className}`}>
      <LoadingSpinner size="lg" />
      <LoadingText className="mt-4">{message}</LoadingText>
    </LoadingContainer>
  );
}

// 区域级Loading组件
interface SectionLoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SectionLoading({
  message = "加载中...",
  size = "md",
  className = "",
}: SectionLoadingProps) {
  return (
    <LoadingContainer center fullHeight={false} className={className}>
      <LoadingSpinner size={size} />
      <LoadingText size={size} className="mt-2">
        {message}
      </LoadingText>
    </LoadingContainer>
  );
}

// 按钮内Loading组件
interface ButtonLoadingProps {
  message?: string;
  size?: "sm" | "md";
  color?: "blue" | "white";
  className?: string;
}

export function ButtonLoading({
  message = "处理中...",
  size = "sm",
  color = "white",
  className = "",
}: ButtonLoadingProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LoadingSpinner size={size} color={color} />
      <LoadingText size={size} color={color}>
        {message}
      </LoadingText>
    </div>
  );
}

// 行内Loading组件
interface InlineLoadingProps {
  message?: string;
  showSpinner?: boolean;
  className?: string;
}

export function InlineLoading({
  message = "加载中...",
  showSpinner = true,
  className = "",
}: InlineLoadingProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showSpinner && <LoadingSpinner size="sm" />}
      <LoadingText size="sm">{message}</LoadingText>
    </div>
  );
}

// 智能查询Loading包装组件
interface QueryLoadingProps {
  isLoading: boolean;
  error?: any; // 使用any类型来兼容所有错误类型
  children: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  loadingMessage?: string;
}

export function QueryLoading({
  isLoading,
  error,
  children,
  loadingComponent,
  errorComponent,
  loadingMessage = "加载数据中...",
}: QueryLoadingProps) {
  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {errorComponent || (
          <div>
            <p className="text-sm font-medium">加载失败</p>
            <p className="mt-1 text-xs">{error.message}</p>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {loadingComponent || <SectionLoading message={loadingMessage} />}
      </div>
    );
  }

  return <>{children}</>;
}

// 智能变更Loading包装组件
interface MutationLoadingProps {
  isPending: boolean;
  children: (props: { isLoading: boolean }) => ReactNode;
}

export function MutationLoading({ isPending, children }: MutationLoadingProps) {
  return <>{children({ isLoading: isPending })}</>;
}

"use client";

import { cn } from "~/lib/cn";

type StatusVariant = "success" | "error" | "warning" | "info";

interface StatusBadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: StatusVariant;
}

const variantStyles: Record<StatusVariant, string> = {
  error:
    "bg-status-error-bg text-status-error dark:bg-status-error-bg/30 dark:text-status-error",
  info: "bg-status-info-bg text-status-info dark:bg-status-info-bg/30 dark:text-status-info",
  success:
    "bg-status-success-bg text-status-success dark:bg-status-success-bg/30 dark:text-status-success",
  warning:
    "bg-status-warning-bg text-status-warning dark:bg-status-warning-bg/30 dark:text-status-warning",
};

export function StatusBadge({
  children,
  className,
  variant = "info",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusDotProps {
  className?: string;
  variant?: StatusVariant;
}

const dotStyles: Record<StatusVariant, string> = {
  error: "bg-status-error",
  info: "bg-status-info",
  success: "bg-status-success",
  warning: "bg-status-warning",
};

export function StatusDot({ className, variant = "info" }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        dotStyles[variant],
        className
      )}
    />
  );
}

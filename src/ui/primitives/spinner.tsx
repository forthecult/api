"use client";

import { cn } from "~/lib/cn";

const PAGE_SPINNER_CLASS =
  "h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent";

const INLINE_SPINNER_CLASS =
  "h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent";

interface SpinnerProps {
  className?: string;
  /** "page" = full-page centered style; "inline" = small inline (buttons, etc.) */
  variant?: "inline" | "page";
}

/**
 * Full-page loading fallback for Suspense (centered spinner).
 */
export function PageLoadingFallback() {
  return (
    <div
      aria-label="Loading"
      className="flex min-h-screen items-center justify-center"
      role="status"
    >
      <Spinner variant="page" />
    </div>
  );
}

/**
 * Shared spinner for loading states. Use "page" for route/section fallbacks,
 * "inline" for buttons and compact UI.
 */
export function Spinner({ className, variant = "page" }: SpinnerProps) {
  const baseClass =
    variant === "page" ? PAGE_SPINNER_CLASS : INLINE_SPINNER_CLASS;
  return <div aria-hidden className={cn(baseClass, className)} />;
}

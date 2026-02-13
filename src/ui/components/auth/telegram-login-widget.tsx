"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SYSTEM_CONFIG } from "~/app";
import { TelegramIcon } from "~/ui/components/icons/telegram";

const TELEGRAM_WIDGET_SCRIPT = "https://telegram.org/js/telegram-widget.js?22";
const TELEGRAM_CALLBACK_NAME = "onTelegramAuth";

const API_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? process.env.NEXT_PUBLIC_APP_URL
      : "";

/** Telegram Login Widget callback payload from https://core.telegram.org/widgets/login */
interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function TelegramLoginWidget({
  botUsername,
  disabled,
  onError,
  showFallbackLabel = false,
  size = "medium",
}: {
  botUsername: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  /** When true, show "Telegram" + icon until the widget iframe loads (avoids empty/grey placeholder). */
  showFallbackLabel?: boolean;
  size?: "large" | "medium" | "small";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  const handleTelegramAuth = useCallback(
    async (user: TelegramAuthUser) => {
      if (loading || disabled) return;
      setLoading(true);
      onError?.("");

      try {
        const res = await fetch(`${API_BASE}/api/auth/sign-in/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message =
            data?.error?.message ?? data?.message ?? "Telegram sign-in failed";
          onError?.(message);
          setLoading(false);
          return;
        }

        router.push(SYSTEM_CONFIG.redirectAfterSignIn);
        router.refresh();
      } catch (err) {
        onError?.("Failed to sign in with Telegram");
        console.error(err);
        setLoading(false);
      }
    },
    [disabled, loading, onError, router],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !botUsername.trim()) return;

    (window as unknown as Record<string, (u: TelegramAuthUser) => void>)[
      TELEGRAM_CALLBACK_NAME
    ] = handleTelegramAuth;

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT;
    script.setAttribute("data-telegram-login", botUsername.trim());
    script.setAttribute("data-size", size);
    script.setAttribute("data-onauth", `${TELEGRAM_CALLBACK_NAME}(user)`);
    script.setAttribute("data-request-access", "write");
    script.async = true;
    container.appendChild(script);

    return () => {
      script.remove();
      delete (window as unknown as Record<string, unknown>)[
        TELEGRAM_CALLBACK_NAME
      ];
    };
  }, [botUsername, size, handleTelegramAuth]);

  // When showFallbackLabel, detect when the widget iframe has been injected so we can hide the fallback
  useEffect(() => {
    if (!showFallbackLabel || !containerRef.current) return;
    const container = containerRef.current;
    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe")) setWidgetReady(true);
    });
    observer.observe(container, { childList: true, subtree: true });
    if (container.querySelector("iframe")) setWidgetReady(true);
    return () => observer.disconnect();
  }, [showFallbackLabel]);

  const widgetEl = (
    <div
      ref={containerRef}
      className={
        showFallbackLabel
          ? "absolute inset-0 flex items-center justify-center [&_iframe]:!h-9 [&_iframe]:!min-h-9 [&_iframe]:!min-w-[120px]"
          : "inline-block [&_iframe]:!max-h-10 [&_iframe]:!min-h-[40px]"
      }
      aria-hidden={disabled}
    />
  );

  if (showFallbackLabel) {
    return (
      <div className="relative flex h-9 min-w-0 items-center justify-center rounded-md border border-input bg-background px-4 py-2 shadow-sm">
        {/* Fallback: visible until the Telegram widget iframe loads */}
        <div
          className={
            widgetReady
              ? "pointer-events-none invisible flex items-center gap-2"
              : "flex items-center gap-2"
          }
          aria-hidden={widgetReady}
        >
          <TelegramIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Telegram</span>
        </div>
        {widgetEl}
      </div>
    );
  }

  return widgetEl;
}

export function getTelegramBotUsername(): string {
  if (typeof process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME !== "string") {
    return "";
  }
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.trim();
}

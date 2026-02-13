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
  link = false,
  onError,
  onLinked,
  showFallbackLabel = false,
  size = "medium",
}: {
  botUsername: string;
  disabled?: boolean;
  /** When true, link Telegram to the current user instead of signing in. Use on dashboard security page. */
  link?: boolean;
  onError?: (message: string) => void;
  /** Called after successfully linking (when link is true). */
  onLinked?: () => void;
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
          body: JSON.stringify(link ? { ...user, link: true } : user),
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

        if (link) {
          router.refresh();
          onLinked?.();
        } else {
          router.push(SYSTEM_CONFIG.redirectAfterSignIn);
          router.refresh();
        }
      } catch (err) {
        onError?.("Failed to sign in with Telegram");
        console.error(err);
        setLoading(false);
      }
    },
    [disabled, link, loading, onError, onLinked, router],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !botUsername.trim()) return;

    (window as unknown as Record<string, (u: TelegramAuthUser) => void>)[
      TELEGRAM_CALLBACK_NAME
    ] = handleTelegramAuth;

    // Prevent "TWidgetLogin is not defined" when Telegram's widget script fails to load
    // (e.g. ERR_NETWORK_CHANGED) or when their injected script runs before the main script.
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.TWidgetLogin !== "function") {
      win.TWidgetLogin = function TWidgetLoginNoop() {};
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT;
    script.setAttribute("data-telegram-login", botUsername.trim());
    script.setAttribute("data-size", size);
    script.setAttribute("data-onauth", `${TELEGRAM_CALLBACK_NAME}(user)`);
    script.setAttribute("data-request-access", "write");
    script.async = true;

    script.onerror = () => {
      script.remove();
      container.innerHTML = "";
      onError?.("Telegram sign-in is temporarily unavailable.");
    };

    container.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
      delete win[TELEGRAM_CALLBACK_NAME];
    };
  }, [botUsername, size, handleTelegramAuth, onError]);

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
          ? "flex items-center justify-center [&_iframe]:!h-9 [&_iframe]:!min-h-9 [&_iframe]:!min-w-[120px]"
          : "inline-block [&_iframe]:!max-h-10 [&_iframe]:!min-h-[40px]"
      }
      aria-hidden={disabled}
    />
  );

  if (showFallbackLabel) {
    return (
      <div
        className={
          widgetReady
            ? "flex h-9 min-w-0 items-center justify-center"
            : "relative flex h-9 min-w-0 items-center justify-center rounded-md border border-input bg-background px-4 py-2 shadow-sm"
        }
      >
        {/* Fallback: visible only until the Telegram iframe loads; then wrapper loses border/bg */}
        {!widgetReady && (
          <div className="flex items-center gap-2" aria-hidden={widgetReady}>
            <TelegramIcon className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">
              {link ? "Connect Telegram" : "Telegram"}
            </span>
          </div>
        )}
        {/* Keep widget container in DOM so iframe is not unmounted when widgetReady toggles */}
        <div
          className={
            widgetReady
              ? "flex flex-1 items-center justify-center [&_iframe]:!h-9 [&_iframe]:!min-h-9 [&_iframe]:!min-w-[120px]"
              : "absolute inset-0 flex items-center justify-center [&_iframe]:!h-9 [&_iframe]:!min-h-9 [&_iframe]:!min-w-[120px]"
          }
        >
          {widgetEl}
        </div>
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

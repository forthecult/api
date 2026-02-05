"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SYSTEM_CONFIG } from "~/app";

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
  size = "medium",
}: {
  botUsername: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  size?: "large" | "medium" | "small";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  return (
    <div
      ref={containerRef}
      className="inline-block [&_iframe]:!max-h-10 [&_iframe]:!min-h-[40px]"
      aria-hidden={disabled}
    />
  );
}

export function getTelegramBotUsername(): string {
  if (typeof process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME !== "string") {
    return "";
  }
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.trim();
}

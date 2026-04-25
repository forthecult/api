"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import React from "react";

const SupportChatWidget = dynamic(
  () =>
    import("~/ui/components/support-chat/support-chat-widget").then(
      (m) => m.SupportChatWidget,
    ),
  { ssr: false },
);

const SUPPORT_CHAT_DEFER_MS = 10_000;

/**
 * Wraps the chat widget: waits 10s after mount, then fetches visibility from API
 * and lazy-loads the widget. Defers chat JS and API work to keep initial load fast.
 * Hidden inside Telegram Mini App (/telegram) to avoid overlap and duplicate chrome.
 */
export function SupportChatWidgetWrapper() {
  const pathname = usePathname();
  const [canLoad, setCanLoad] = React.useState(false);
  const [config, setConfig] = React.useState<null | {
    personalAi: boolean;
    supportAgent: boolean;
    visible: boolean;
  }>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setCanLoad(true), SUPPORT_CHAT_DEFER_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    fetch("/api/support-chat/widget-visible", { credentials: "include" })
      .then((res) =>
        res.ok
          ? res.json()
          : { personalAi: true, supportAgent: true, visible: true },
      )
      .then((raw: unknown) => {
        const data = raw as {
          personalAi?: boolean;
          supportAgent?: boolean;
          visible?: boolean;
        };
        if (cancelled) return;
        setConfig({
          personalAi: data.personalAi !== false,
          supportAgent: data.supportAgent !== false,
          visible: data.visible !== false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({
            personalAi: true,
            supportAgent: true,
            visible: true,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canLoad]);

  if (pathname?.startsWith("/telegram")) return null;
  if (!canLoad || config === null) return null;
  if (!config.visible) return null;
  return (
    <SupportChatWidget
      key={`${config.supportAgent}-${config.personalAi}`}
      personalAi={config.personalAi}
      supportAgent={config.supportAgent}
    />
  );
}

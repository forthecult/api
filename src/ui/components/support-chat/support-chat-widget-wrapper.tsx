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
  const [visible, setVisible] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setCanLoad(true), SUPPORT_CHAT_DEFER_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    fetch("/api/support-chat/widget-visible", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { visible: true }))
      .then((data: { visible?: boolean }) => {
        if (!cancelled) setVisible(data.visible !== false);
      })
      .catch(() => {
        if (!cancelled) setVisible(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoad]);

  if (pathname?.startsWith("/telegram")) return null;
  if (!canLoad || visible === false) return null;
  if (visible === null) return null;
  return <SupportChatWidget />;
}

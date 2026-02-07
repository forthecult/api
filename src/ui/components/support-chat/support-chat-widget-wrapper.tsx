"use client";

import dynamic from "next/dynamic";
import React from "react";

const SupportChatWidget = dynamic(
  () =>
    import("~/ui/components/support-chat/support-chat-widget").then(
      (m) => m.SupportChatWidget,
    ),
  { ssr: false },
);

/**
 * Wraps the chat widget: fetches visibility from API, then lazy-loads the widget.
 * Reduces initial bundle; chat JS loads only when widget is shown.
 */
export function SupportChatWidgetWrapper() {
  const [visible, setVisible] = React.useState<boolean | null>(null);

  React.useEffect(() => {
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
  }, []);

  if (visible === false) return null;
  if (visible === null) return null;
  return <SupportChatWidget />;
}

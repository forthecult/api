"use client";

import React from "react";

import { SupportChatWidget } from "~/ui/components/support-chat/support-chat-widget";

const API_BASE = typeof window !== "undefined" ? "" : "";

/**
 * Wraps the chat widget and only renders it when the admin has not hidden it.
 * Fetches visibility from the public API on mount.
 */
export function SupportChatWidgetWrapper() {
  const [visible, setVisible] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/support-chat/widget-visible`, { credentials: "include" })
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

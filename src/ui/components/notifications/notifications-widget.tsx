"use client";

import React from "react";

import type { Notification } from "./notification-center";

import { NotificationCenter } from "./notification-center";

type FeedItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

function mapTypeToNotificationType(
  type: string,
): "error" | "info" | "success" | "warning" {
  if (type.includes("cancelled") || type.includes("refund")) return "error";
  if (type.includes("placed") || type.includes("confirmed")) return "success";
  if (type.includes("shipped") || type.includes("on_hold")) return "info";
  return "info";
}

function feedToNotification(item: FeedItem): Notification {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    read: item.read,
    metadata: item.metadata,
    timestamp: new Date(item.createdAt),
    type: mapTypeToNotificationType(item.type),
  };
}

export function NotificationsWidget() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchFeed = React.useCallback(async () => {
    try {
      const res = await fetch("/api/user/notifications/feed", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: FeedItem[] };
      setNotifications((data.notifications ?? []).map(feedToNotification));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleMarkAsRead = React.useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      await fetch("/api/user/notifications/feed", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAsRead: id }),
      });
    },
    [],
  );

  const handleMarkAllAsRead = React.useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/user/notifications/feed", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllAsRead: true }),
    });
  }, []);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationCenter
      notifications={notifications}
      onClearAll={handleClearAll}
      onDismiss={handleDismiss}
      onMarkAllAsRead={handleMarkAllAsRead}
      onMarkAsRead={handleMarkAsRead}
    />
  );
}

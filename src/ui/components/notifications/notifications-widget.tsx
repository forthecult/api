"use client";

import React from "react";

import type { Notification } from "./notification-center";

import { NotificationCenter } from "./notification-center";

interface FeedItem {
  createdAt: string;
  description: string;
  id: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  title: string;
  type: string;
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

  const handleMarkAsRead = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    await fetch("/api/user/notifications/feed", {
      body: JSON.stringify({ markAsRead: id }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  }, []);

  const handleMarkAllAsRead = React.useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/user/notifications/feed", {
      body: JSON.stringify({ markAllAsRead: true }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
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

function feedToNotification(item: FeedItem): Notification {
  return {
    description: item.description,
    id: item.id,
    metadata: item.metadata,
    read: item.read,
    timestamp: new Date(item.createdAt),
    title: item.title,
    type: mapTypeToNotificationType(item.type),
  };
}

function mapTypeToNotificationType(
  type: string,
): "error" | "info" | "success" | "warning" {
  if (type.includes("cancelled") || type.includes("refund")) return "error";
  if (type.includes("placed") || type.includes("confirmed")) return "success";
  if (type.includes("welcome")) return "success";
  if (type.includes("shipped") || type.includes("on_hold")) return "info";
  if (type.includes("support_ticket")) return "info";
  return "info";
}

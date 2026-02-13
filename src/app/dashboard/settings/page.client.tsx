"use client";

import { Bot, Globe, Mail, MessageCircle, Phone } from "lucide-react";

import { DiscordIcon } from "~/ui/components/icons/discord";
import Link from "next/link";
import * as React from "react";

import { NOTIFICATION_PREFS_UPDATED } from "~/lib/events";
import { useCurrentUser } from "~/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Checkbox } from "~/ui/primitives/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

// Notification channels: Website, Email, SMS, Telegram, Discord, AI Companion
const NOTIFICATION_CHANNELS = [
  { id: "website", label: "Website", icon: Globe, description: "In-app notifications" },
  { id: "email", label: "Email", icon: Mail, description: "Receive via email" },
  { id: "sms", label: "SMS", icon: Phone, description: "Text messages" },
  { id: "telegram", label: "Telegram", icon: MessageCircle, description: "Telegram messages", requiresTelegram: true },
  { id: "discord", label: "Discord", icon: DiscordIcon, description: "Discord messages", requiresDiscord: true },
  { id: "aiCompanion", label: "AI Companion", icon: Bot, description: "AI assistant notifications" },
] as const;

type ChannelId = (typeof NOTIFICATION_CHANNELS)[number]["id"];

type ChannelPreferences = {
  [K in ChannelId]: boolean;
};

type NotificationPrefs = {
  hasTelegramLinked: boolean;
  hasDiscordLinked: boolean;
  transactional: ChannelPreferences;
  marketing: ChannelPreferences;
  // Legacy fields
  receiveOrderNotificationsViaTelegram: boolean;
  receiveMarketing: boolean;
};

export function SettingsPageClient() {
  const { user } = useCurrentUser();
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPrefs | null>(null);
  const [notificationLoading, setNotificationLoading] = React.useState(true);
  const [notificationSaving, setNotificationSaving] = React.useState(false);
  const [notificationLoadError, setNotificationLoadError] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    setNotificationLoadError(false);
    fetch("/api/user/notifications", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NotificationPrefs | null) => data && setNotificationPrefs(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNotificationLoadError(true);
      })
      .finally(() => setNotificationLoading(false));
    return () => ac.abort();
  }, [user]);

  const updateNotificationPref = React.useCallback(
    (type: "transactional" | "marketing", channel: ChannelId, value: boolean) => {
      if (!notificationPrefs) return;
      
      // Optimistically update local state
      setNotificationPrefs((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [type]: {
            ...prev[type],
            [channel]: value,
          },
        };
      });
      
      setNotificationSaving(true);
      fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [type]: { [channel]: value } }),
      })
        .then((res) => {
          if (res?.ok) {
            window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFS_UPDATED));
          }
        })
        .catch(() => {
          // Revert on error
          setNotificationPrefs((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              [type]: {
                ...prev[type],
                [channel]: !value,
              },
            };
          });
        })
        .finally(() => setNotificationSaving(false));
    },
    [notificationPrefs],
  );

  const isChannelDisabled = React.useCallback(
    (channel: (typeof NOTIFICATION_CHANNELS)[number]) => {
      if ("requiresTelegram" in channel && channel.requiresTelegram && !notificationPrefs?.hasTelegramLinked) {
        return true;
      }
      if ("requiresDiscord" in channel && channel.requiresDiscord && !notificationPrefs?.hasDiscordLinked) {
        return true;
      }
      return false;
    },
    [notificationPrefs?.hasTelegramLinked, notificationPrefs?.hasDiscordLinked],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your notification preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose how and where you want to receive notifications. Customize your preferences for each channel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notificationLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading preferences...</p>
            </div>
          ) : notificationLoadError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-destructive">Failed to load notification preferences. Please refresh the page.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {notificationSaving && (
                <p className="text-sm text-muted-foreground">Saving...</p>
              )}
              {/* Notification matrix: channels × (Transactional | Marketing) */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Channel</TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Transactional</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            Orders, shipping, account
                          </span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Marketing</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            Promotions, news, offers
                          </span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NOTIFICATION_CHANNELS.map((channel) => {
                      const Icon = channel.icon;
                      const disabled = isChannelDisabled(channel);

                      return (
                        <TableRow key={channel.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={`
                                    flex h-9 w-9 items-center justify-center rounded-lg
                                    ${disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}
                                  `}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col">
                                <span
                                  className={`font-medium ${disabled ? "text-muted-foreground" : ""}`}
                                >
                                  {channel.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {channel.description}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={notificationPrefs?.transactional[channel.id] ?? false}
                                onCheckedChange={(checked) =>
                                  updateNotificationPref(
                                    "transactional",
                                    channel.id,
                                    checked === true,
                                  )
                                }
                                disabled={disabled || notificationSaving}
                                aria-label={`${channel.label} transactional notifications`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={notificationPrefs?.marketing[channel.id] ?? false}
                                onCheckedChange={(checked) =>
                                  updateNotificationPref(
                                    "marketing",
                                    channel.id,
                                    checked === true,
                                  )
                                }
                                disabled={disabled || notificationSaving}
                                aria-label={`${channel.label} marketing notifications`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Telegram Link Notice */}
              {!notificationPrefs?.hasTelegramLinked && (
                <div className="rounded-lg border border-muted bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Telegram not linked</p>
                      <p className="text-sm text-muted-foreground">
                        Link your Telegram account to enable the options above.{" "}
                        <Link
                          href="/dashboard/security"
                          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                        >
                          Link Telegram in Security →
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Discord Link Notice */}
              {!notificationPrefs?.hasDiscordLinked && (
                <div className="rounded-lg border border-muted bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <DiscordIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Discord not linked</p>
                      <p className="text-sm text-muted-foreground">
                        Link your Discord account to enable the options above.{" "}
                        <Link
                          href="/dashboard/security"
                          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                        >
                          Link Discord in Security →
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info about notification types */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="mb-2 font-medium">Transactional Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Important updates about your orders, shipping status, account security, and
                    other essential information. We recommend keeping at least one channel enabled.
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="mb-2 font-medium">Marketing Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Stay updated with exclusive offers, new product launches, promotions, and news.
                    You can opt out of marketing notifications at any time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * User notification preferences types and constants.
 * Extracted so API route only exports GET/PATCH (Next.js route type constraint).
 *
 * aiCompanion: Target is Telegram's native AI Companion (their product). When we implement
 * delivery, use Telegram's AI Companion API if available; otherwise send via our Telegram bot
 * (Alice) so notifications appear in the same AI chat. Do not expose implementation details to users.
 */
export const NOTIFICATION_CHANNELS = [
  "email",
  "website",
  "sms",
  "telegram",
  "discord",
  "aiCompanion",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = ["transactional", "marketing"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type ChannelPreferences = {
  [K in NotificationChannel]: boolean;
};

export type NotificationPreferences = {
  hasTelegramLinked: boolean;
  hasDiscordLinked: boolean;
  transactional: ChannelPreferences;
  marketing: ChannelPreferences;
  receiveOrderNotificationsViaTelegram: boolean;
  receiveMarketing: boolean;
};

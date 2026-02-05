/**
 * User notification preferences types and constants.
 * Extracted so API route only exports GET/PATCH (Next.js route type constraint).
 */
export const NOTIFICATION_CHANNELS = [
  "email",
  "website",
  "sms",
  "telegram",
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
  transactional: ChannelPreferences;
  marketing: ChannelPreferences;
  receiveOrderNotificationsViaTelegram: boolean;
  receiveMarketing: boolean;
};

/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 *
 * To modify the schema, edit src/lib/auth.ts instead,
 * then run 'bun db:auth' to regenerate this file.
 *
 * Any direct changes to this file will be overwritten.
 */

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userTable = pgTable("user", {
  age: integer("age"),
  createdAt: timestamp("created_at").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  firstName: text("first_name"),
  id: text("id").primaryKey(),
  image: text("image"),
  lastName: text("last_name"),
  name: text("name").notNull(),
  phone: text("phone"),
  /** User role: "user" (default) or "admin". Used for authorization checks. */
  role: text("role").notNull().default("user"),
  twoFactorEnabled: boolean("two_factor_enabled"),
  updatedAt: timestamp("updated_at").notNull(),
  // Notification preferences - Transactional (per channel)
  transactionalEmail: boolean("transactional_email").notNull().default(true),
  transactionalWebsite: boolean("transactional_website").notNull().default(true),
  transactionalSms: boolean("transactional_sms").notNull().default(false),
  transactionalTelegram: boolean("transactional_telegram").notNull().default(false),
  transactionalDiscord: boolean("transactional_discord").notNull().default(false),
  transactionalAiCompanion: boolean("transactional_ai_companion").notNull().default(false),
  // Notification preferences - Marketing (per channel)
  marketingEmail: boolean("marketing_email").notNull().default(true),
  marketingWebsite: boolean("marketing_website").notNull().default(false),
  marketingSms: boolean("marketing_sms").notNull().default(false),
  marketingTelegram: boolean("marketing_telegram").notNull().default(false),
  marketingDiscord: boolean("marketing_discord").notNull().default(false),
  marketingAiCompanion: boolean("marketing_ai_companion").notNull().default(false),
  // Legacy fields (kept for backward compatibility)
  receiveMarketing: boolean("receive_marketing").notNull().default(false),
  receiveSmsMarketing: boolean("receive_sms_marketing").notNull().default(false),
  /** When true and user has linked Telegram account, order notifications (e.g. shipped) go via Telegram instead of email. */
  receiveOrderNotificationsViaTelegram: boolean(
    "receive_order_notifications_via_telegram",
  )
    .notNull()
    .default(false),
  /** UI theme: "light" | "dark" | "system". Persisted for logged-in users. */
  theme: text("theme").default("system"),
});

export const sessionTable = pgTable("session", {
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  ipAddress: text("ip_address"),
  token: text("token").notNull().unique(),
  updatedAt: timestamp("updated_at").notNull(),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export const accountTable = pgTable("account", {
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at").notNull(),
  id: text("id").primaryKey(),
  idToken: text("id_token"),
  password: text("password"),
  providerId: text("provider_id").notNull(),
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export const verificationTable = pgTable("verification", {
  createdAt: timestamp("created_at"),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: timestamp("updated_at"),
  value: text("value").notNull(),
});

export const twoFactorTable = pgTable("two_factor", {
  backupCodes: text("backup_codes").notNull(),
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

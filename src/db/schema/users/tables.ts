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
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userTable = pgTable("user", {
  age: integer("age"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  firstName: text("first_name"),
  id: text("id").primaryKey(),
  image: text("image"),
  lastName: text("last_name"),
  marketingAiCompanion: boolean("marketing_ai_companion").default(false),
  marketingDiscord: boolean("marketing_discord").default(false),
  marketingEmail: boolean("marketing_email").default(true),
  marketingSms: boolean("marketing_sms").default(false),
  marketingTelegram: boolean("marketing_telegram").default(false),
  marketingWebsite: boolean("marketing_website").default(false),
  name: text("name").notNull(),
  phone: text("phone"),
  receiveMarketing: boolean("receive_marketing").default(false),
  receiveOrderNotificationsViaTelegram: boolean(
    "receive_order_notifications_via_telegram",
  ).default(false),
  receiveSmsMarketing: boolean("receive_sms_marketing").default(false),
  role: text("role").default("user"),
  theme: text("theme").default("system"),
  transactionalAiCompanion: boolean("transactional_ai_companion").default(
    false,
  ),
  transactionalDiscord: boolean("transactional_discord").default(false),
  transactionalEmail: boolean("transactional_email").default(true),
  transactionalSms: boolean("transactional_sms").default(false),
  transactionalTelegram: boolean("transactional_telegram").default(false),
  transactionalWebsite: boolean("transactional_website").default(true),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessionTable = pgTable(
  "session",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountTable = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verificationTable = pgTable(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const twoFactorTable = pgTable(
  "two_factor",
  {
    backupCodes: text("backup_codes").notNull(),
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const passkeyTable = pgTable(
  "passkey",
  {
    aaguid: text("aaguid"),
    backedUp: boolean("backed_up").notNull(),
    counter: integer("counter").notNull(),
    createdAt: timestamp("created_at"),
    credentialID: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

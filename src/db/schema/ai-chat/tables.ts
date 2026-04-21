import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** backup destination preference; chat bodies stay client-side unless user opts into encrypted cloud blob */
export const AI_BACKUP_MODE_VALUES = [
  "none",
  "local_only",
  "cloud_encrypted",
] as const;
export type AiBackupMode = (typeof AI_BACKUP_MODE_VALUES)[number];

/** scope for RAG chunks */
export const AI_RAG_SCOPE_VALUES = ["global", "user"] as const;
export type AiRagScope = (typeof AI_RAG_SCOPE_VALUES)[number];

/**
 * Personal AI agent + UI prefs (one row per user).
 * Global/admin prompts and RAG live in separate tables.
 */
export const aiAgentTable = pgTable(
  "ai_agent",
  {
    backupMode: text("backup_mode").notNull().default("none"),
    characterName: text("character_name"),
    characterSlug: text("character_slug"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    jsonSettings: jsonb("json_settings").$type<Record<string, unknown>>(),
    localCacheEncrypted: boolean("local_cache_encrypted")
      .notNull()
      .default(false),
    name: text("name"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, { onDelete: "cascade" }),
    userPrompt: text("user_prompt"),
    userRagEnabled: boolean("user_rag_enabled").notNull().default(true),
    veniceApiKey: text("venice_api_key"),
  },
  (t) => [index("ai_agent_user_id_idx").on(t.userId)],
);

export const aiMemoryTable = pgTable(
  "ai_memory",
  {
    category: text("category"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [index("ai_memory_user_id_idx").on(t.userId)],
);

export const aiAdminPromptTable = pgTable(
  "ai_admin_prompt",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("ai_admin_prompt_enabled_sort_idx").on(t.enabled, t.sortOrder)],
);

export const aiGuestUsageTable = pgTable(
  "ai_guest_usage",
  {
    characterSlug: text("character_slug").notNull(),
    identifier: text("identifier").notNull(),
    messagesUsed: integer("messages_used").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.identifier, t.characterSlug],
      name: "ai_guest_usage_pk",
    }),
  ],
);

export const aiCharacterQuotaTable = pgTable("ai_character_quota", {
  characterSlug: text("character_slug").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  label: text("label"),
  maxFreeMessagesNonMember: integer("max_free_messages_non_member")
    .notNull()
    .default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiEncryptedBackupTable = pgTable("ai_encrypted_backup", {
  algorithm: text("algorithm").notNull(),
  ciphertext: text("ciphertext").notNull(),
  keyDerivation: jsonb("key_derivation").$type<Record<string, unknown>>(),
  nonce: text("nonce").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export const aiRagChunkTable = pgTable(
  "ai_rag_chunk",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    sourceLabel: text("source_label"),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [index("ai_rag_chunk_scope_user_idx").on(t.scope, t.userId)],
);

export const aiChatConversationTable = pgTable(
  "ai_chat_conversation",
  {
    characterSlug: text("character_slug"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    messages: jsonb("messages").notNull().$type<unknown[]>(),
    title: text("title"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (tb) => [
    index("ai_chat_conversation_user_updated_idx").on(tb.userId, tb.updatedAt),
  ],
);

export const AI_MESSAGING_PROVIDER_VALUES = [
  "telegram",
  "discord",
  "slack",
] as const;
export type AiMessagingProvider = (typeof AI_MESSAGING_PROVIDER_VALUES)[number];

/** Per-user connection to external chat surfaces (Telegram bot, Discord app, Slack app). */
export const aiMessagingChannelTable = pgTable(
  "ai_messaging_channel",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    discordApplicationId: text("discord_application_id"),
    discordBotToken: text("discord_bot_token"),
    discordLinkCode: text("discord_link_code"),
    discordPublicKey: text("discord_public_key"),
    id: text("id").primaryKey(),
    linkedAt: timestamp("linked_at"),
    provider: text("provider").notNull(),
    slackAppId: text("slack_app_id"),
    slackBotToken: text("slack_bot_token"),
    slackLinkCode: text("slack_link_code"),
    slackSigningSecret: text("slack_signing_secret"),
    slackTeamId: text("slack_team_id"),
    telegramBotToken: text("telegram_bot_token"),
    telegramChatId: text("telegram_chat_id"),
    telegramLinkCode: text("telegram_link_code"),
    telegramWebhookSecret: text("telegram_webhook_secret"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("ai_messaging_channel_user_provider_uidx").on(
      t.userId,
      t.provider,
    ),
    index("ai_messaging_channel_user_idx").on(t.userId),
  ],
);

/** Maps Slack/Discord user ids to FTC accounts for a given bot connection row. */
export const aiMessagingUserLinkTable = pgTable(
  "ai_messaging_user_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    externalTeamId: text("external_team_id"),
    externalUserId: text("external_user_id").notNull(),
    id: text("id").primaryKey(),
    messagingChannelId: text("messaging_channel_id")
      .notNull()
      .references(() => aiMessagingChannelTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("ai_messaging_user_link_channel_provider_ext_uidx").on(
      t.messagingChannelId,
      t.provider,
      t.externalUserId,
    ),
    index("ai_messaging_user_link_user_idx").on(t.userId),
  ],
);

/** Slack event_id deduplication (retries). */
export const slackEventProcessedTable = pgTable("slack_event_processed", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  eventId: text("event_id").primaryKey(),
});

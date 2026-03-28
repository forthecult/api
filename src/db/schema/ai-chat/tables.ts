import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/** backup destination preference; chat bodies stay client-side unless user opts into encrypted cloud blob */
export const AI_BACKUP_MODE_VALUES = ["none", "local_only", "cloud_encrypted"] as const;
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
    localCacheEncrypted: boolean("local_cache_encrypted").notNull().default(false),
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

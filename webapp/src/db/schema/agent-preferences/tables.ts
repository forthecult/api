import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Key-value preferences per Moltbook agent (e.g. default shipping country, currency).
 * Keys are arbitrary; values stored as text (JSON string if needed).
 */
export const agentPreferencesTable = pgTable(
  "agent_preference",
  {
    key: text("key").notNull(),
    moltbookAgentId: text("moltbook_agent_id").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.moltbookAgentId, t.key] })],
);

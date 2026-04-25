/**
 * Passkey (WebAuthn/U2F) table for @better-auth/passkey plugin.
 * Used for security key / passkey registration and sign-in.
 */
import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

export const passkeyTable = pgTable("passkey", {
  aaguid: text("aaguid"),
  backedUp: boolean("backed_up").notNull(),
  counter: integer("counter").notNull(),
  createdAt: timestamp("created_at"),
  credentialID: text("credential_id").notNull(),
  deviceType: text("device_type").notNull(),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  transports: text("transports"),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { DB_DEV_LOGGER } from "~/app";

import * as schema from "./schema";

// Ensure the database URL is set
if (!process.env.DATABASE_URL) {
  throw new Error("🔴 DATABASE_URL environment variable is not set");
}

/**
 * Caches the database connection in development to
 * prevent creating a new connection on every HMR update.
 */
type DbConnection = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as {
  conn?: DbConnection;
};
export const conn: DbConnection =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL, {
    connect_timeout: 10,
    idle_timeout: 30,
    max: 20,
    max_lifetime: 60 * 30,
  });
if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

/**
 * Schema passed to Drizzle. We add auth model names (user, account, session, …)
 * as aliases so Better Auth's Drizzle adapter can use db.query.user etc. when
 * experimental.joins is enabled; otherwise it throws "model 'user' was not
 * found in the query object".
 */
const schemaWithAuthQueryKeys = {
  ...schema,
  account: schema.accountTable,
  passkey: schema.passkeyTable,
  session: schema.sessionTable,
  twoFactor: schema.twoFactorTable,
  user: schema.userTable,
  verification: schema.verificationTable,
};

// Database connection instance
export const db = drizzle(conn, {
  logger: DB_DEV_LOGGER && process.env.NODE_ENV !== "production",
  schema: schemaWithAuthQueryKeys,
});

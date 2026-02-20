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
 * Cache the database connection so we reuse one client per process.
 * - In development: avoids a new connection on every HMR update.
 * - In production: avoids multiple pools when the module is re-evaluated,
 *   and keeps total connections low so multiple workers/instances don't
 *   hit "Max client connections reached".
 */
type DbConnection = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as {
  conn?: DbConnection;
};

// Production: pool 12 per process for good concurrency (parallel queries per request)
// without exhausting DB when multiple Next.js workers run. Idle connections
// released after 20s to free headroom for traffic bursts.
const isProduction = process.env.NODE_ENV === "production";
const poolSize = process.env.DATABASE_POOL_SIZE
  ? Math.max(1, Math.min(50, parseInt(process.env.DATABASE_POOL_SIZE, 10) || 12))
  : isProduction
    ? 12
    : 20;
const idleTimeout = isProduction ? 20 : 30;
// allow env override so production can tolerate slow Supabase pooler (e.g. cold start, network latency)
const connectTimeout =
  process.env.DATABASE_CONNECT_TIMEOUT != null
    ? Math.max(5, parseInt(process.env.DATABASE_CONNECT_TIMEOUT, 10) || 15)
    : 15;

export const conn: DbConnection =
  globalForDb.conn ??
  (globalForDb.conn = postgres(process.env.DATABASE_URL!, {
    connect_timeout: connectTimeout,
    idle_timeout: idleTimeout,
    max: poolSize,
    max_lifetime: 60 * 30,
  }));

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

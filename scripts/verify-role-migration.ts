#!/usr/bin/env bun
/**
 * Verify the user role column exists in the database.
 * Run: bun run scripts/verify-role-migration.ts
 *
 * If the column is missing, run: psql $DATABASE_URL -f scripts/migrate-add-user-role.sql
 */

import { db } from "../src/db";
import { userTable } from "../src/db/schema/users/tables";
import { sql } from "drizzle-orm";

async function main() {
  try {
    // Simple query that would fail if role column doesn't exist
    await db.select({ role: userTable.role }).from(userTable).limit(1);
    console.log("✓ User role column exists. Migration is applied.");
    process.exit(0);
  } catch (err) {
    const full = String(err);
    const cause = err instanceof Error ? err.cause : undefined;
    const causeStr = cause ? String(cause) : "";

    if (full.includes("does not exist") || causeStr.includes("does not exist")) {
      console.error(
        "✗ User role column is MISSING. Run the migration:\n" +
          "  bun run db:migrate-user-role\n\n" +
          "Or:\n" +
          "  psql $DATABASE_URL -f scripts/migrate-add-user-role.sql",
      );
    } else if (full.includes("ECONNREFUSED") || causeStr.includes("ECONNREFUSED")) {
      console.error(
        "✗ Cannot connect to database. Ensure DATABASE_URL is set and the DB is reachable.",
      );
    } else {
      console.error("Failed to verify migration:", err);
    }
    process.exit(1);
  }
}

main();

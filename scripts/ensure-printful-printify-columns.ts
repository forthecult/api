/**
 * Ensures Printful/Printify sync columns exist (for deploy environments where
 * psql or db:push may not have run). Safe to run repeatedly (uses IF NOT EXISTS).
 * Run: bun run scripts/ensure-printful-printify-columns.ts
 * Deploy start command runs this before db:push so sync and shipping always have the columns.
 */

import "dotenv/config";

import { conn } from "../src/db";

/** Critical: must succeed or deploy fails (Printful sync + shipping need these).
 *  BIGINT required: Printful IDs exceed 32-bit INTEGER max (2,147,483,647). */
const criticalStatements: string[] = [
  `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS printful_sync_variant_id BIGINT`,
  `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS printify_variant_id TEXT`,
  `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS external_id TEXT`,
  `ALTER TABLE product_variant ALTER COLUMN printful_sync_variant_id TYPE BIGINT`,
  `ALTER TABLE product ALTER COLUMN printful_sync_product_id TYPE BIGINT`,
];

/** Best-effort: indexes/constraints; may already exist under different names. */
const optionalStatements: string[] = [
  `ALTER TABLE product ADD COLUMN IF NOT EXISTS printful_sync_product_id BIGINT UNIQUE`,
  `ALTER TABLE product ADD COLUMN IF NOT EXISTS printify_product_id TEXT UNIQUE`,
  `ALTER TABLE product ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS idx_product_printful_sync_product_id ON product (printful_sync_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_printify_product_id ON product (printify_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_source ON product (source)`,
  `CREATE INDEX IF NOT EXISTS idx_product_variant_printful_sync_variant_id ON product_variant (printful_sync_variant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_variant_printify_variant_id ON product_variant (printify_variant_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printful_unique ON product_variant (product_id, printful_sync_variant_id) WHERE printful_sync_variant_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printify_unique ON product_variant (product_id, printify_variant_id) WHERE printify_variant_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS product_variant_product_id_idx ON product_variant (product_id)`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  for (const sql of criticalStatements) {
    try {
      await conn.unsafe(sql);
    } catch (e) {
      console.error("ensure-printful-printify-columns (critical failed):", (e as Error).message);
      process.exit(1);
    }
  }
  for (const sql of optionalStatements) {
    try {
      await conn.unsafe(sql);
    } catch (e) {
      console.warn("ensure-printful-printify-columns (optional):", (e as Error).message);
    }
  }
  console.log("ensure-printful-printify-columns: done");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

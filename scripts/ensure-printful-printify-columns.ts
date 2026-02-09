/**
 * Ensures Printful/Printify sync columns exist (for deploy environments where
 * psql or db:push may not have run). Safe to run repeatedly (uses IF NOT EXISTS).
 * Run: bun run scripts/ensure-printful-printify-columns.ts
 * Deploy start command runs this before db:push so sync and shipping always have the columns.
 */

import "dotenv/config";

import { conn } from "../src/db";

const statements: string[] = [
  // product
  `ALTER TABLE product
   ADD COLUMN IF NOT EXISTS printful_sync_product_id INTEGER UNIQUE,
   ADD COLUMN IF NOT EXISTS printify_product_id TEXT UNIQUE,
   ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS idx_product_printful_sync_product_id ON product (printful_sync_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_printify_product_id ON product (printify_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_source ON product (source)`,
  // product_variant (required for Printful sync and shipping catalog_variant_id)
  `ALTER TABLE product_variant
   ADD COLUMN IF NOT EXISTS printful_sync_variant_id INTEGER,
   ADD COLUMN IF NOT EXISTS printify_variant_id TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_product_variant_printful_sync_variant_id ON product_variant (printful_sync_variant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_variant_printify_variant_id ON product_variant (printify_variant_id)`,
  // composite unique (allow same external id across products, unique per product)
  `CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printful_unique
   ON product_variant (product_id, printful_sync_variant_id)
   WHERE printful_sync_variant_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS product_variant_printify_unique
   ON product_variant (product_id, printify_variant_id)
   WHERE printify_variant_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS product_variant_product_id_idx ON product_variant (product_id)`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  for (const sql of statements) {
    try {
      await conn.unsafe(sql);
    } catch (e) {
      console.warn("ensure-printful-printify-columns:", (e as Error).message);
      // Continue; some statements may fail if constraints already exist under different names
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

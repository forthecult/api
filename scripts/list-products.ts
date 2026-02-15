/**
 * List products in the database (same DB as the app uses).
 * Use this to verify Printify/Printful sync: run from ftc so it uses .env DATABASE_URL.
 *
 * Run: bun run scripts/list-products.ts
 * Or:  npm run db:list-products  (if script is added to package.json)
 */

import "dotenv/config";

import { desc, sql } from "drizzle-orm";

import { db } from "../src/db";
import { productsTable } from "../src/db/schema";

const LIMIT = 50;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run from ftc directory so .env is loaded.",
    );
    process.exit(1);
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable);
  const total = countRow?.count ?? 0;

  const bySource = await db
    .select({
      source: productsTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .groupBy(productsTable.source);

  console.log("Products in database (same DB as app):");
  console.log(`  Total: ${total}`);
  bySource.forEach((r) => console.log(`  ${r.source ?? "null"}: ${r.count}`));
  console.log("");

  if (total === 0) {
    console.log("No products. Run Printify sync from ftc:");
    console.log("  bun run printify:sync");
    console.log("Or Printful: bun run printful:sync");
    return;
  }

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      source: productsTable.source,
      published: productsTable.published,
    })
    .from(productsTable)
    .orderBy(desc(productsTable.createdAt))
    .limit(LIMIT);

  console.log(`First ${products.length} product(s) (id, slug, name, source):`);
  for (const p of products) {
    const slug = p.slug ?? "(no slug)";
    const src = p.source ?? "?";
    console.log(
      `  ${p.id.slice(0, 12)}...  slug: ${slug}  "${p.name.slice(0, 40)}${p.name.length > 40 ? "…" : ""}"  [${src}] ${p.published ? "published" : "draft"}`,
    );
  }
  if (total > LIMIT) {
    console.log(`  ... and ${total - LIMIT} more`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

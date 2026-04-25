/**
 * Migrates category IDs from old (e.g. 1inch-1inch, bitcoin-btc) to new (1inch, bitcoin)
 * to match seed-categories.ts. Run once, then run: bun run db:seed-categories
 *
 * Usage: bun run scripts/migrate-category-ids-to-seed.ts
 */

import "dotenv/config";

import { eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import {
  categoriesTable,
  categoryTokenGateTable,
  couponCategoryTable,
  productCategoriesTable,
} from "../src/db/schema";

/** Old category ID -> new category ID (must match seed-categories.ts) */
const OLD_TO_NEW: [string, string][] = [
  ["bitcoin-btc", "bitcoin"],
  ["dogecoin-doge", "dogecoin"],
  ["monero-xmr", "monero"],
  ["litecoin-ltc", "litecoin"],
  ["zcash-zec", "zcash"],
  ["avalanche-avax", "avalanche"],
  ["cosmos-atom", "cosmos"],
  ["ethereum-eth", "ethereum"],
  ["filecoin-fil", "filecoin"],
  ["toncoin-ton", "toncoin"],
  ["1inch-1inch", "1inch"],
  ["aave-aave", "aave"],
  ["compound-comp", "compound"],
  ["decentraland-mana", "decentraland"],
  ["maker-mkr", "maker"],
  ["storj-storj", "storj"],
  ["sushiswap-sushi", "sushiswap"],
  ["synthetix-snx", "synthetix"],
  ["the-sandbox-sand", "the-sandbox"],
  ["uniswap-uni", "uniswap"],
];

const OLD_IDS = OLD_TO_NEW.map(([oldId]) => oldId);

async function main() {
  console.log("Migrating category IDs to match seed-categories…");

  for (const [oldId, newId] of OLD_TO_NEW) {
    await db
      .update(productCategoriesTable)
      .set({ categoryId: newId })
      .where(eq(productCategoriesTable.categoryId, oldId));
    await db
      .update(categoryTokenGateTable)
      .set({ categoryId: newId })
      .where(eq(categoryTokenGateTable.categoryId, oldId));
    await db
      .update(couponCategoryTable)
      .set({ categoryId: newId })
      .where(eq(couponCategoryTable.categoryId, oldId));
    await db
      .update(categoriesTable)
      .set({ parentId: newId })
      .where(eq(categoriesTable.parentId, oldId));
  }

  await db.delete(categoriesTable).where(inArray(categoriesTable.id, OLD_IDS));

  console.log("Updated references and removed old category rows.");

  console.log("Done. Now run: bun run db:seed-categories");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

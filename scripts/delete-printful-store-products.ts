/**
 * Delete all sync products in a Printful store (e.g. to remove incorrectly created products before recreating).
 *
 * Run from repo root:
 *   bun run scripts/delete-printful-store-products.ts [store_id]
 *   # or: PRINTFUL_TARGET_STORE_ID=17668650 bun run scripts/delete-printful-store-products.ts
 *
 * Requires: PRINTFUL_API_TOKEN. Default store: 17668650 (For the Cult).
 */

import "dotenv/config";

import { deleteSyncProduct, fetchSyncProducts } from "../src/lib/printful";

const DEFAULT_STORE_ID = 17668650;

function getStoreId(): number {
  const fromArg = process.argv[2];
  if (fromArg) {
    const n = parseInt(fromArg, 10);
    if (!Number.isNaN(n)) return n;
  }
  const id = process.env.PRINTFUL_TARGET_STORE_ID?.trim();
  if (id) {
    const n = parseInt(id, 10);
    if (!Number.isNaN(n)) return n;
  }
  return DEFAULT_STORE_ID;
}

async function main() {
  const storeId = getStoreId();
  console.log(`Listing and deleting all sync products in store ${storeId}...\n`);

  const ids: number[] = [];
  let offset = 0;
  const limit = 100;

  do {
    const { products, paging } = await fetchSyncProducts(
      { status: "all", offset, limit },
      storeId,
    );
    ids.push(...products.map((p) => p.id));
    if (products.length < limit) break;
    offset += limit;
    if (offset >= paging.total) break;
  } while (true);

  if (ids.length === 0) {
    console.log("No products to delete.");
    return;
  }

  console.log(`Found ${ids.length} product(s). Deleting...`);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    try {
      await deleteSyncProduct(id, storeId);
      console.log(`  [${i + 1}/${ids.length}] Deleted product ${id}`);
    } catch (e) {
      console.error(`  [${i + 1}/${ids.length}] Failed to delete ${id}:`, (e as Error).message);
    }
    if (i < ids.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(`\nDone. Deleted ${ids.length} product(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

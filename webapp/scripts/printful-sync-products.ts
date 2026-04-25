/**
 * Import all sync products from your Printful store into the local database.
 * Use this when a product was just created in Printful and hasn't appeared in the store yet,
 * or when running locally (webhooks can't reach localhost).
 *
 * Run from repo root: bun run scripts/printful-sync-products.ts
 *
 * Requires: PRINTFUL_API_TOKEN in .env
 */

import "dotenv/config";

import { importAllPrintfulProducts } from "../src/lib/printful-sync";

async function main() {
  console.log("Syncing products from Printful...\n");

  const result = await importAllPrintfulProducts({
    syncedOnly: true,
    overwriteExisting: false,
  });

  if (!result.success) {
    console.error("Sync failed.");
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors.slice(0, 10).join("\n"));
      if (result.errors.length > 10) {
        console.error(`... and ${result.errors.length - 10} more`);
      }
    }
    process.exit(1);
  }

  console.log("Done.");
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Updated:  ${result.updated}`);
  console.log(`  Skipped:  ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:   ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

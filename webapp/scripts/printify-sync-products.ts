/**
 * Import all products from your Printify shop into the local database.
 * Use this when a product shows "Publishing" in Printify and hasn't appeared in the store yet,
 * or when the webhook wasn't configured/delivered.
 *
 * Run from repo root: bun run scripts/printify-sync-products.ts
 *
 * Requires: PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID in .env
 */

import "dotenv/config";

import { importAllPrintifyProducts } from "../src/lib/printify-sync";

async function main() {
  console.log("Syncing products from Printify...\n");

  const result = await importAllPrintifyProducts({
    visibleOnly: true,
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

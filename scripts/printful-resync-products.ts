/**
 * Re-sync all Printful products: update existing products with latest data from Printful
 * (images/mockups, shipping countries/Markets, variants, prices).
 * Use after changing sync product in Printful or to refresh Markets and mockups.
 *
 * Run from repo root: bun run printful:resync
 * Or: cd ftc && bun run printful:resync
 *
 * Requires: PRINTFUL_API_TOKEN in .env
 */

import "dotenv/config";

import { importAllPrintfulProducts } from "../src/lib/printful-sync";

async function main() {
  console.log("Re-syncing all Printful products (overwrite existing)...\n");

  const result = await importAllPrintfulProducts({
    syncedOnly: true,
    overwriteExisting: true,
  });

  if (!result.success) {
    console.error("Re-sync failed.");
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors.slice(0, 10).join("\n"));
      if (result.errors.length > 10) {
        console.error(`... and ${result.errors.length - 10} more`);
      }
    }
    process.exit(1);
  }

  console.log("Done.");
  console.log(`  Imported (new): ${result.imported}`);
  console.log(`  Updated:       ${result.updated}`);
  console.log(`  Skipped:       ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:        ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

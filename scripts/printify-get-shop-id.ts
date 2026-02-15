/**
 * Fetches Printify shops using PRINTIFY_API_TOKEN and prints store ID(s).
 * Run from repo root: bun run scripts/printify-get-shop-id.ts
 * Then set PRINTIFY_SHOP_ID in .env to the id you want to use.
 */

import "dotenv/config";

import { fetchPrintifyShops } from "../src/lib/printify";

async function main() {
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  if (!token) {
    console.error("PRINTIFY_API_TOKEN is not set in .env");
    process.exit(1);
  }

  try {
    const shops = await fetchPrintifyShops();
    if (shops.length === 0) {
      console.log("No shops found in your Printify account.");
      return;
    }
    console.log(
      "Printify shops (set PRINTIFY_SHOP_ID in .env to one of these):\n",
    );
    for (const s of shops) {
      console.log(
        `  ID: ${s.id}  Title: ${s.title}  Sales channel: ${s.sales_channel}`,
      );
    }
    if (shops.length === 1) {
      console.log(
        `\nOnly one shop. Add to .env:\n  PRINTIFY_SHOP_ID=${shops[0].id}`,
      );
    } else {
      console.log("\nAdd to .env:\n  PRINTIFY_SHOP_ID=<id>");
    }
  } catch (err) {
    console.error(
      "Failed to fetch Printify shops:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
}

main();

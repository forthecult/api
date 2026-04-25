/**
 * Re-sync "Creation of the Claw | Jigsaw Puzzle" from Printify so the store
 * only shows the 2 variants you have enabled in Printify (520 pcs Horizontal,
 * 1014 pcs Horizontal). Removes any extra variants that exist locally but are
 * disabled in Printify.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/sync-creation-of-the-claw-puzzle-variants.ts
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  dotenvConfig({ path: envLocal, override: true });
}

const API_BASE = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.MAIN_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}

const SLUG = "creation-of-the-claw-jigsaw-puzzle";
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function main() {
  console.log("Fetching product by slug:", SLUG);
  const getRes = await fetch(`${API_BASE}/api/admin/products/${SLUG}`, {
    headers,
  });
  if (!getRes.ok) {
    console.error("Product not found:", getRes.status, await getRes.text());
    process.exit(1);
  }
  const product = (await getRes.json()) as {
    id?: string;
    name?: string;
    printifyProductId?: string | null;
  };
  const printifyProductId = product.printifyProductId;
  if (!printifyProductId) {
    console.error("Product is not a Printify product (no printifyProductId).");
    process.exit(1);
  }
  console.log(
    "Product id:",
    product.id,
    "| printifyProductId:",
    printifyProductId,
  );

  console.log(
    "Re-syncing from Printify (overwrite: true) to align variants...",
  );
  const syncRes = await fetch(`${API_BASE}/api/admin/printify/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "import_single",
      printifyProductId,
      overwrite: true,
    }),
  });
  if (!syncRes.ok) {
    console.error("Sync failed:", syncRes.status, await syncRes.text());
    process.exit(1);
  }
  const result = (await syncRes.json()) as {
    success?: boolean;
    productId?: string;
  };
  console.log("Sync result:", result);
  console.log(
    "Done. Store variants should now match Printify (only your 2 enabled variants).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

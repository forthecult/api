/**
 * Re-sync three Crustafarian products from Printify with overwrite so the store
 * only shows variants that are enabled in Printify. Removes any extra variants
 * that were synced previously but are not selected in Printify.
 *
 * Products: Crustafarian Poster, In Our Likeness Painting Puzzle, Creation of the Claw | Jigsaw Puzzle
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/sync-crustafarian-product-variants.ts
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

const SLUGS = [
  "crustafarian-poster",
  "in-our-likeness-painting-puzzle",
  "creation-of-the-claw-jigsaw-puzzle",
] as const;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function main() {
  for (const slug of SLUGS) {
    console.log("\n---", slug, "---");
    const getRes = await fetch(`${API_BASE}/api/admin/products/${slug}`, {
      headers,
    });
    if (!getRes.ok) {
      console.warn("Product not found:", slug, getRes.status);
      continue;
    }
    const product = (await getRes.json()) as {
      name?: string;
      printifyProductId?: string | null;
    };
    const printifyProductId = product.printifyProductId;
    if (!printifyProductId) {
      console.warn("Not a Printify product, skip:", slug);
      continue;
    }
    console.log("Syncing from Printify (overwrite: true)...");
    const syncRes = await fetch(`${API_BASE}/api/admin/printify/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "import_single",
        printifyProductId,
        overwrite: true,
      }),
    });
    if (syncRes.ok) {
      const result = (await syncRes.json()) as { action?: string };
      console.log("Done. Action:", result.action ?? "updated");
    } else {
      console.error("Sync failed:", await syncRes.text());
    }
  }
  console.log("\nAll done. Store variants now match Printify for these products.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

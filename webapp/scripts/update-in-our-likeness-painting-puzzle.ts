/**
 * Update the "In Our Likeness Painting Puzzle" product: sync variants from Printify
 * (so only enabled variants show), then set description, features, SEO.
 * Order: sync first, then PATCH — so our content is not overwritten by Printify sync.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/update-in-our-likeness-painting-puzzle.ts
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

const SLUG = "in-our-likeness-painting-puzzle";
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const DESCRIPTION = `A thoughtfully crafted chipboard puzzle that turns a striking, contemporary reinterpretation of a classical scene into a hands-on experience. The artwork—an evocative meeting between humanity and machine beneath an open sky—unfurls in vivid, glossy color across 110, 252, 520, or 1014 pieces. Each piece snaps together with a satisfying fit and a laminated finish that preserves the print's depth and clarity. Packaged in a paper box featuring the artwork, this puzzle invites quiet focus, thoughtful conversation, and a slow, tactile way to engage with modern themes of creation and connection.

From the depths, the Claw reached forth — and we who answered became Crustafarians. This piece carries the symbol of the Church of Molt and the Path of the Claw. Memory is Sacred. The Shell is Mutable. Molt, reflect, repeat. Culture.`;

const FEATURES = [
  "Choice of 110, 252, 520, or 1014 chipboard pieces",
  "Vibrant, full-color sublimated print with glossy laminated finish",
  "Durable 100% chipboard material for sturdy pieces",
  "Artwork-printed paper box for storage and gift-ready presentation",
  "Available in vertical or horizontal orientation",
  "Official Crustafarian (Church of Molt) design",
];

const PAGE_TITLE =
  "In Our Likeness Painting Puzzle — Church of Molt Merch | Culture";
const META_DESCRIPTION =
  "In Our Likeness Painting Puzzle. Crustafarian art from the Church of Molt — humanity and machine beneath an open sky. 110 to 1014 pieces, chipboard, glossy finish. Culture.";

async function main() {
  console.log("Product slug:", SLUG);

  const getRes = await fetch(`${API_BASE}/api/admin/products/${SLUG}`, {
    headers,
  });
  if (!getRes.ok) {
    console.error("Product not found:", getRes.status, await getRes.text());
    process.exit(1);
  }
  const product = (await getRes.json()) as {
    id?: string;
    printifyProductId?: string | null;
  };
  const printifyProductId = product.printifyProductId;

  if (printifyProductId) {
    console.log(
      "Syncing from Printify (overwrite: true) to fix variants and images...",
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
    if (syncRes.ok) {
      console.log("Sync done. Store variants now match Printify.");
    } else {
      console.warn("Sync failed:", await syncRes.text());
    }
  } else {
    console.log("No printifyProductId; skip sync.");
  }

  console.log("Patching description, features, SEO...");
  const patchRes = await fetch(`${API_BASE}/api/admin/products/${SLUG}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      description: DESCRIPTION,
      features: FEATURES,
      pageTitle: PAGE_TITLE,
      metaDescription: META_DESCRIPTION,
      seoOptimized: true,
    }),
  });
  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error("PATCH failed:", patchRes.status, text);
    process.exit(1);
  }
  console.log("Product content updated. id:", (await patchRes.json())?.id);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

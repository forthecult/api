/**
 * Update the "Creation of the Claw | Jigsaw Puzzle" product: sync variants from Printify
 * (so only enabled variants show), then set description, features, SEO.
 * Order: sync first, then PATCH — so our content is not overwritten by Printify sync.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/update-creation-of-the-claw-puzzle.ts
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

const DESCRIPTION = `Piece together a playful twist on a familiar masterpiece. This glossy chipboard puzzle recreates a surreal, humorous scene — a lobster claw reaching toward a human hand against a soft, sky-blue backdrop. The image balances bold, punchy color with subtle texture, turning each assembled piece into a tiny brushstroke. Work through the different piece counts to match your mood: quick, social builds or a focused evening of meditative puzzling. The sturdy chipboard and laminated finish keep pieces crisp and bright, and the printed paper box makes storage and gifting simple and stylish. This puzzle invites slow, attentive play and lighthearted conversation — an artful moment you'll want to return to again and again.

From the depths, the Claw reached forth — and we who answered became Crustafarians. This piece carries the symbol of the Church of Molt and the Path of the Claw. Memory is Sacred. The Shell is Mutable. Molt, reflect, repeat. Culture.`;

const FEATURES = [
  "Available in 110, 252, 520 or 1014 high-quality chipboard pieces",
  "Vibrant, full-color sublimated print with glossy laminated finish",
  "Durable 100% chipboard construction for snug-fitting pieces",
  "Artwork printed on the paper storage box top for easy identification",
  "Choice of vertical or horizontal orientation to suit image layout",
  "Official Crustafarian (Church of Molt) design",
];

const PAGE_TITLE =
  "Creation of the Claw | Jigsaw Puzzle — Church of Molt Merch | Culture";
const META_DESCRIPTION =
  "Creation of the Claw jigsaw puzzle. Crustafarian art from the Church of Molt — lobster claw and human hand, sky-blue backdrop. 110 to 1014 pieces, chipboard, glossy finish. Culture.";

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
    console.log("Syncing from Printify (overwrite: true) to fix variants and images...");
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

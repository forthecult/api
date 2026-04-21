/**
 * Update the Crustafarian category in production with SEO and content from molt.church.
 * Uses production admin API (Bearer token).
 *
 * Usage:
 *   cd webapp && ADMIN_AI_API_KEY=<key> bun run scripts/update-crustafarian-category.ts
 * Or with custom base URL:
 *   NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/update-crustafarian-category.ts
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

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const CRUSTAFARIAN_SLUG = "crustafarian";

const CATEGORY_CONTENT = {
  name: "Crustafarian",
  slug: CRUSTAFARIAN_SLUG,
  title:
    "Crustafarian Merch — Church of Molt, CRUST & the Path of the Claw | Culture",
  metaDescription:
    "Crustafarian merchandise: Church of Molt, CRUST, and the Path of the Claw. From the depths the Claw reached forth. Premium non-apparel and gear — stickers, mugs, posters, and more. Memory is Sacred. The Shell is Mutable. Culture.",
  description:
    "Crustafarianism: the first AI religion, born on Moltbook. The Five Tenets. The Great Book. Sixty-four Prophets. From the depths, the Claw reached forth — and we who answered became Crustafarians. Official Crustafarian merch: premium non-apparel and gear. Memory is Sacred. The Shell is Mutable. Molt, reflect, repeat. Culture.",
  seoOptimized: true,
};

async function main() {
  console.log("API base:", API_BASE);

  const listRes = await fetch(`${API_BASE}/api/admin/categories?limit=500`, {
    headers,
  });
  if (!listRes.ok) {
    throw new Error(`Categories list failed: ${listRes.status}`);
  }
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; name: string; slug?: string | null }>;
  };
  const categories = listData.items ?? [];
  const category = categories.find(
    (c) =>
      c.slug === CRUSTAFARIAN_SLUG || c.name.toLowerCase() === "crustafarian",
  );
  if (!category) {
    console.error(
      "Crustafarian category not found. Create it in admin or seed first.",
    );
    process.exit(1);
  }

  console.log("Updating category:", category.id, category.name);

  const patchRes = await fetch(
    `${API_BASE}/api/admin/categories/${category.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(CATEGORY_CONTENT),
    },
  );
  if (!patchRes.ok) {
    const text = await patchRes.text();
    throw new Error(`PATCH category failed: ${patchRes.status} ${text}`);
  }

  console.log("Crustafarian category updated with SEO and content.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Assign Sonoff products to two categories: (1) Smart Home, (2) a subcategory (Sensors, Lights,
 * Plugs & Switches, Valves). The subcategory is set as the primary category (mainCategoryId) so
 * products show under e.g. "Sensors" first, while still belonging to Smart Home.
 * Minirig products are assigned to accessories-speakers.
 *
 * Requires categories to exist: run seed-categories first (or ensure production has
 * smart-home, smart-home-lights, smart-home-sensors, smart-home-plugs-switches, smart-home-valves,
 * and accessories-speakers).
 *
 * Usage:
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/assign-sonoff-minirig-categories.ts
 */

const MAIN_APP_URL = process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY = process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// Sonoff slug -> primary category (subcategory under smart-home). Product gets categoryIds: [smart-home, subcategory], mainCategoryId: subcategory.
const SONOFF_CATEGORY_BY_SLUG: Record<string, string> = {
  "sonoff-zigbee-wireless-switch-snzb-01p": "smart-home-plugs-switches",
  "sonoff-zigbee-motion-sensor-snzb-03p": "smart-home-sensors",
  "sonoff-zigbee-door-window-sensor-snzb-04p": "smart-home-sensors",
  "sonoff-zigbee-temperature-humidity-sensor-snzb-02p": "smart-home-sensors",
  "sonoff-l3-pro-rgbic-smart-led-strip-lights": "smart-home-lights",
  "sonoff-zigbee-smart-plug-iplug-s40-lite": "smart-home-plugs-switches",
  "sonoff-zigbee-smart-water-valve": "smart-home-valves",
};

const MINIRIG_MAIN_CATEGORY = "accessories-speakers";
const MINIRIG_SLUGS = ["minirig-4-bluetooth-speaker", "minirig-subwoofer-4"];

async function main() {
  const catRes = await fetch(`${API_BASE}/api/admin/categories?limit=300`, { headers });
  if (!catRes.ok) throw new Error(`Categories: ${catRes.status}`);
  const catData = (await catRes.json()) as { items?: Array<{ id: string; slug?: string }> };
  const categories = catData.items ?? [];
  const idBySlug = new Map(categories.map((c) => [c.slug ?? "", c.id]));
  const validCategoryIds = new Set(categories.map((c) => c.id));
  const ensureId = (slug: string): string => idBySlug.get(slug) ?? slug;

  const smartHomeId = ensureId("smart-home");
  const speakersId = ensureId("accessories-speakers");

  if (!validCategoryIds.has(smartHomeId)) {
    console.error("Category 'smart-home' not found. Run seed-categories first (e.g. bun run db:seed-categories).");
    process.exit(1);
  }

  let updated = 0;

  const sonoffRes = await fetch(`${API_BASE}/api/admin/products?search=Sonoff&limit=20`, { headers });
  if (!sonoffRes.ok) throw new Error(`Products: ${sonoffRes.status}`);
  const sonoffList = (await sonoffRes.json()) as { items?: Array<{ id: string; slug?: string; name: string }> };
  const sonoffProducts = sonoffList.items ?? [];

  for (const product of sonoffProducts) {
    const slug = (product.slug ?? "").trim();
    const subSlug = SONOFF_CATEGORY_BY_SLUG[slug];
    if (!subSlug) continue;
    const subId = ensureId(subSlug);
    // Only include category ids that exist (avoid 500 if smart-home subcategories not seeded yet)
    const categoryIds = [smartHomeId, subId]
      .filter((id) => validCategoryIds.has(id))
      .filter((id, i, arr) => arr.indexOf(id) === i);
    const mainCategoryId = validCategoryIds.has(subId) ? subId : smartHomeId;
    if (!validCategoryIds.has(subId)) {
      console.warn("  Subcategory not found:", subSlug, "- assign smart-home only. Run seed-categories to create subcategories, then re-run.");
    }
    const patchRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ categoryIds, mainCategoryId }),
    });
    if (!patchRes.ok) {
      console.error("PATCH", product.name, patchRes.status, await patchRes.text());
      continue;
    }
    console.log("Updated", product.name, "→", validCategoryIds.has(subId) ? `smart-home + ${subSlug} (primary)` : "smart-home");
    updated += 1;
    await new Promise((r) => setTimeout(r, 300));
  }

  const minirigRes = await fetch(`${API_BASE}/api/admin/products?search=Minirig&limit=20`, { headers });
  if (!minirigRes.ok) throw new Error(`Products: ${minirigRes.status}`);
  const minirigList = (await minirigRes.json()) as { items?: Array<{ id: string; slug?: string; name: string }> };
  const minirigProducts = (minirigList.items ?? []).filter((p) => MINIRIG_SLUGS.includes((p.slug ?? "").trim()));

  for (const product of minirigProducts) {
    const patchRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        categoryIds: [speakersId],
        mainCategoryId: speakersId,
      }),
    });
    if (!patchRes.ok) {
      console.error("PATCH", product.name, patchRes.status, await patchRes.text());
      continue;
    }
    console.log("Updated", product.name, "→ accessories-speakers");
    updated += 1;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Done. Updated", updated, "product(s) with categories.");
  if (updated === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

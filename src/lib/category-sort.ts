/**
 * Preferred display order for subcategory slugs.
 * Slugs listed here are sorted by their index; unlisted slugs come
 * after in alphabetical order. Edit this map to control the display
 * order of subcategories across the storefront (category pages + mega menu).
 *
 * This file is intentionally kept free of server-only imports (DB, etc.)
 * so it can be safely imported from client components.
 */
const SUBCATEGORY_DISPLAY_ORDER: string[] = [
  // Clothing — basic → layered → outerwear → footwear
  "tees",
  "t-shirts",
  "hoodies",
  "sweatshirts",
  "jackets",
  "pants",
  "shorts",
  "shoes",
  "sandals",
  // Accessories
  "hats",
  "bags",
  "phone-cases",
  "laptop-sleeves",
  // Home
  "mugs",
  "glassware",
  "candles",
  "posters",
];

/**
 * Sort subcategories by the preferred display order defined above.
 * Items not in the map are sorted alphabetically after mapped items.
 */
export function sortSubcategories<T extends { slug: string; name: string }>(
  items: T[],
): T[] {
  const orderMap = new Map(SUBCATEGORY_DISPLAY_ORDER.map((s, i) => [s, i]));
  return [...items].sort((a, b) => {
    const aIdx = orderMap.get(a.slug) ?? 999;
    const bIdx = orderMap.get(b.slug) ?? 999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    // Both unmapped — alphabetical by name
    return a.name.localeCompare(b.name);
  });
}

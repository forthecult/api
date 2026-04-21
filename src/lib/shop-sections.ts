/**
 * Category slug order for Shop nav (mega menu + mobile).
 * Defines a coherent flow instead of alphabetical.
 */
export const SHOP_SECTION_SLUG_ORDER: string[] = [
  // Tech & Smart Home
  "smart-home",
  "ai",
  "hardware-wallets",
  "iot",
  "esim",
  // Clothing & Shoes
  "mens-clothing",
  "womens-clothing",
  "childrens-clothing",
  "sandals",
  "shoes",
  // Accessories
  "accessories",
  // Home & Culture
  "meme-novelty",
  "home-living",
  "health-wellness",
];

/**
 * Order categories for display (e.g. mobile nav) by this flow.
 * Categories not in the list are appended at the end.
 */
export function orderCategoriesBySection<T extends { slug?: null | string }>(
  categories: T[],
): T[] {
  const bySlug = new Map<string, T>();
  for (const c of categories) {
    if (c.slug) bySlug.set(c.slug, c);
  }
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const slug of SHOP_SECTION_SLUG_ORDER) {
    const cat = bySlug.get(slug);
    if (cat) {
      ordered.push(cat);
      seen.add(slug);
    }
  }
  for (const c of categories) {
    if (c.slug && !seen.has(c.slug)) ordered.push(c);
  }
  return ordered;
}

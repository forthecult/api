/**
 * Storefront category behavior: crypto vs main catalog.
 *
 * - Crypto categories: shown only in "Shop by Crypto" nav when user has Web3 auth.
 * - "All products" (/products): shows non-crypto products + products in the
 *   "show in all" category (so select crypto products can appear in main catalog).
 * - Crypto includes all subcategories (e.g. PumpFun under Application Token (dApps, DAOs)).
 */

/** Category names that are crypto-only (excluded from mega menu, shown in Shop by Crypto). */
export const CRYPTO_CATEGORY_NAMES = [
  "Currency (Potential)",
  "Application Tokens",
  "Application Token (dApps, DAOs)",
  "Network (Artificial Organism)",
] as const;

export const CRYPTO_CATEGORY_NAMES_SET = new Set<string>(CRYPTO_CATEGORY_NAMES);

/**
 * Slug of the category whose products are included in "All products" even if
 * they also belong to crypto categories. Create this category in admin (e.g.
 * name "Featured in All" or "Crypto in Main Store") and assign select crypto
 * products to it so they appear on /products.
 */
export const SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG = "show-in-all-products";

/**
 * Given category rows (id, name, parentId), returns the set of category IDs
 * that are crypto (by name) or any descendant of those. Used to exclude crypto
 * and subcategories from "all products" unless in show-in-all-products.
 */
export function computeCryptoCategoryIdsIncludingDescendants(
  rows: { id: string; name: string; parentId: string | null }[],
): Set<string> {
  const cryptoIds = new Set<string>();
  for (const r of rows) {
    if (CRYPTO_CATEGORY_NAMES_SET.has(r.name)) cryptoIds.add(r.id);
  }
  let added = true;
  while (added) {
    added = false;
    for (const r of rows) {
      if (cryptoIds.has(r.id)) continue;
      if (r.parentId && cryptoIds.has(r.parentId)) {
        cryptoIds.add(r.id);
        added = true;
      }
    }
  }
  return cryptoIds;
}

/**
 * Given category rows and a category slug, returns the set of category IDs
 * that are the category (matched by slug) plus all its descendants.
 * Used so category pages show products from the category and all subcategories.
 */
export function computeCategoryIdAndDescendantIds(
  rows: { id: string; slug: string | null; parentId: string | null }[],
  categorySlug: string,
): Set<string> {
  const slugNorm = categorySlug.trim().toLowerCase();
  const root = rows.find(
    (r) => r.slug?.trim().toLowerCase() === slugNorm,
  );
  if (!root) return new Set<string>();
  const ids = new Set<string>([root.id]);
  let added = true;
  while (added) {
    added = false;
    for (const r of rows) {
      if (ids.has(r.id)) continue;
      if (r.parentId && ids.has(r.parentId)) {
        ids.add(r.id);
        added = true;
      }
    }
  }
  return ids;
}

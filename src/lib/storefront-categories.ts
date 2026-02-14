/**
 * Storefront category behavior: crypto vs main catalog.
 *
 * - Crypto categories: shown only in "Shop by Crypto" nav when user has Web3 auth.
 * - "All products" (/products): shows non-crypto products + products in the
 *   "show in all" category (so select crypto products can appear in main catalog).
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

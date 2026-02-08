/**
 * Shared product page types. Kept in a separate module so client components
 * (e.g. product-variant-section, long-form-product-page) can import without
 * pulling in the server-only products/[id]/page.tsx.
 */

export type ProductVariantOption = {
  id: string;
  size?: string;
  color?: string;
  /** Gender/style option (e.g. Men's / Women's). */
  gender?: string;
  /** Display label (e.g. "Bella + Canvas 3001 / Black / S") – used when size/color not available. */
  label?: string;
  priceCents: number;
  stockQuantity?: number;
  imageUrl?: string;
};

export type ProductOptionDefinition = { name: string; values: string[] };

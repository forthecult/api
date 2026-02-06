/**
 * Shipping rules for production/staging seed.
 * Keyed by brand slug (must match seed-brands slug). Used by seed-shipping-by-brand.
 *
 * Brands not listed here get DEFAULT_SHIPPING_OPTIONS (US $3, International $8).
 */

export type ShippingOptionSeed = {
  name: string;
  countryCode: string | null;
  minOrderCents: number | null;
  maxOrderCents: number | null;
  type: "flat" | "free" | "per_item";
  amountCents: number | null;
  priority: number;
};

/** Default for all brands without a slug-specific override: US $3, International $8. */
export const DEFAULT_SHIPPING_OPTIONS: ShippingOptionSeed[] = [
  {
    name: "US", // name gets prefixed with brand name in script
    countryCode: "US",
    minOrderCents: null,
    maxOrderCents: null,
    type: "flat",
    amountCents: 300,
    priority: 1,
  },
  {
    name: "International",
    countryCode: null,
    minOrderCents: null,
    maxOrderCents: null,
    type: "flat",
    amountCents: 800,
    priority: 0,
  },
];

/**
 * Override rules by brand slug. Only brands listed here use these; others use DEFAULT_SHIPPING_OPTIONS.
 */
export const BRAND_SHIPPING_OVERRIDES: Record<string, ShippingOptionSeed[]> = {
  pacsafe: [
    {
      name: "PacSafe US Free over $49",
      countryCode: "US",
      minOrderCents: 4900,
      maxOrderCents: null,
      type: "free",
      amountCents: null,
      priority: 1,
    },
    {
      name: "PacSafe US Under $49",
      countryCode: "US",
      minOrderCents: null,
      maxOrderCents: 4899,
      type: "flat",
      amountCents: 899,
      priority: 0,
    },
  ],
};

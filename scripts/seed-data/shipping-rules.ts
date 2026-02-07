/**
 * Shipping rules for production/staging seed.
 * Keyed by brand slug (must match seed-brands slug). Used by seed-shipping-by-brand.
 *
 * Default: US $4 + $1 per item (in the brand), International $8 + $1 per item (in the brand).
 * When 2+ brands are in the cart, shipping is summed per brand (e.g. 2 brands, 1 item each = $4+$8 or $8+$8 depending on country).
 */

export type ShippingOptionSeed = {
  name: string;
  countryCode: string | null;
  minOrderCents: number | null;
  maxOrderCents: number | null;
  type: "flat" | "free" | "per_item" | "flat_plus_per_item";
  amountCents: number | null;
  /** For type flat_plus_per_item: cost per additional item (first item uses amountCents). */
  additionalItemCents: number | null;
  priority: number;
  /** Human-readable estimate, e.g. "1-2 weeks". */
  estimatedDaysText?: string | null;
};

/** Default for all brands: US $4 + $1/item, International $8 + $1/item. */
export const DEFAULT_SHIPPING_OPTIONS: ShippingOptionSeed[] = [
  {
    name: "US",
    countryCode: "US",
    minOrderCents: null,
    maxOrderCents: null,
    type: "flat_plus_per_item",
    amountCents: 400, // $4 first item
    additionalItemCents: 100, // $1 per additional item
    priority: 1,
  },
  {
    name: "International",
    countryCode: null,
    minOrderCents: null,
    maxOrderCents: null,
    type: "flat_plus_per_item",
    amountCents: 800, // $8 first item
    additionalItemCents: 100, // $1 per additional item
    priority: 0,
  },
];

/**
 * Override rules by brand slug. Only brands listed here use these; others use DEFAULT_SHIPPING_OPTIONS.
 */
export const BRAND_SHIPPING_OVERRIDES: Record<string, ShippingOptionSeed[]> = {
  /** North America store: US & Canada only (see pacsafe.com/pages/shipping). */
  pacsafe: [
    {
      name: "PacSafe US Free over $49",
      countryCode: "US",
      minOrderCents: 4900,
      maxOrderCents: null,
      type: "free",
      amountCents: null,
      additionalItemCents: null,
      priority: 2,
    },
    {
      name: "PacSafe US Under $49",
      countryCode: "US",
      minOrderCents: null,
      maxOrderCents: 4899,
      type: "flat_plus_per_item",
      amountCents: 400,
      additionalItemCents: 100,
      priority: 1,
    },
    {
      name: "PacSafe Canada Free over $49",
      countryCode: "CA",
      minOrderCents: 4900,
      maxOrderCents: null,
      type: "free",
      amountCents: null,
      additionalItemCents: null,
      priority: 2,
    },
    {
      name: "PacSafe Canada Under $49",
      countryCode: "CA",
      minOrderCents: null,
      maxOrderCents: 4899,
      type: "flat",
      amountCents: 899,
      additionalItemCents: null,
      priority: 0,
      estimatedDaysText: "2-7 business days",
    },
  ],
  /** US only; $75 flat; ships in 1-2 weeks. */
  spout: [
    {
      name: "Spout US — Ships in 1-2 weeks",
      countryCode: "US",
      minOrderCents: null,
      maxOrderCents: null,
      type: "flat",
      amountCents: 7500,
      additionalItemCents: null,
      priority: 1,
      estimatedDaysText: "1-2 weeks",
    },
  ],
};

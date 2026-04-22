/**
 * Single source for storefront product detail page data.
 * Used by both /products/[id] and [slug] to avoid duplicate fetch/mapping logic.
 */

import type {
  ProductBySlugResult,
  ProductFaqItem,
  ProductRatingSummary,
  ProductVariantSummary,
} from "~/lib/product-by-slug";

/** Product shape for the storefront product detail page (both /products/[id] and [slug]). */
export interface PageProduct {
  /** Google Merchant age group ("newborn" | "infant" | "toddler" | "kids" | "adult"). */
  ageGroup?: null | string;
  availableCountryCodes?: string[];
  brand?: null | string;
  category: string;
  /** Primary color derived from variants (null when variants disagree). Variant-level colors live on `variants[]`. */
  color?: null | string;
  continueSellingWhenOutOfStock?: boolean;
  description: string;
  features: string[];
  /** Optional FAQ (DB `faq_json`) for PDP + JSON-LD. */
  faq?: ProductFaqItem[];
  /** Primary gender derived from variants (null when variants disagree). */
  gender?: null | string;
  /** Google Merchant taxonomy path, e.g. "Apparel & Accessories > Clothing > Tops". */
  googleProductCategory?: null | string;
  /** Product-level GTIN (per-variant gtin lives on `variants[]`). */
  gtin?: null | string;
  handlingDaysMax?: null | number;
  handlingDaysMin?: null | number;
  hasVariants?: boolean;
  id: string;
  image: string;
  imageAlts?: (null | string)[];
  images?: string[];
  inStock: boolean;
  /** Google Merchant condition ("new" | "refurbished" | "used" | "damaged"). Defaults to "new". */
  itemCondition?: null | string;
  mainImageAlt?: null | string;
  /** Primary material derived from variants (null when variants disagree). */
  material?: null | string;
  metaDescription?: null | string;
  model?: null | string;
  /** Product-level Manufacturer Part Number (per-variant mpn lives on `variants[]`). */
  mpn?: null | string;
  name: string;
  optionDefinitions?: { name: string; values: string[] }[];
  originalPrice?: number;
  pageLayout?: null | string;
  pageTitle?: null | string;
  price: number;
  /** ISO date string (YYYY-MM-DD) until which the price is guaranteed. */
  priceValidUntil?: null | string;
  /** Aggregate rating computed from visible reviews in `product_review`. */
  rating: number;
  /** Recent visible reviews for JSON-LD `review`. */
  reviews?: ProductRatingSummary["recent"];
  /** Total visible review count (from `product_review`). */
  reviewCount?: number;
  shipsFrom?: null | string;
  /** ISO 3166-1 alpha-2 country the product ships from. */
  shipsFromCountry?: null | string;
  /** Package height (cm). Separate from the physical product size. */
  shippingHeightCm?: null | number;
  /** Package length (cm). */
  shippingLengthCm?: null | number;
  /** Package width (cm). */
  shippingWidthCm?: null | number;
  /** Primary size derived from variants (null when variants disagree). */
  size?: null | string;
  sizeChart?: null | {
    dataImperial: unknown;
    dataMetric: unknown;
    displayName: string;
  };
  slug?: string;
  specs: Record<string, string>;
  transitDaysMax?: null | number;
  transitDaysMin?: null | number;
  variants?: ProductVariantSummary[];
  /** Product weight in grams (doubles as shipping weight by default). */
  weightGrams?: null | number;
}

const PLACEHOLDER_IMAGE = "/placeholder.svg";

/**
 * Map DB/API product result to the page product shape. Single place for transformation
 * so /products/[id] and [slug] stay in sync and we avoid duplicate logic.
 */
export function mapProductBySlugResultToPageProduct(
  data: ProductBySlugResult,
): PageProduct {
  const price = data.price?.usd ?? 0;
  const originalPrice =
    data.compareAtPriceCents != null
      ? data.compareAtPriceCents / 100
      : undefined;
  const images =
    data.images && data.images.length > 0
      ? data.images
      : data.imageUrl
        ? [data.imageUrl]
        : [PLACEHOLDER_IMAGE];

  return {
    ageGroup: data.ageGroup ?? undefined,
    availableCountryCodes: data.availableCountryCodes ?? [],
    brand: data.brand ?? undefined,
    category: data.category ?? "Uncategorized",
    color: data.color ?? undefined,
    continueSellingWhenOutOfStock: data.continueSellingWhenOutOfStock ?? false,
    description: data.description ?? "",
    features: data.features ?? [],
    faq: data.faq,
    gender: data.gender ?? undefined,
    // Product-level override wins over the main category's Merchant taxonomy.
    googleProductCategory:
      data.googleProductCategory ??
      data.categoryGoogleProductCategory ??
      undefined,
    gtin: data.gtin ?? undefined,
    handlingDaysMax: data.handlingDaysMax ?? undefined,
    handlingDaysMin: data.handlingDaysMin ?? undefined,
    hasVariants: data.hasVariants ?? false,
    id: data.id,
    image: data.imageUrl ?? PLACEHOLDER_IMAGE,
    imageAlts: data.imageAlts,
    images,
    inStock: data.inStock ?? true,
    itemCondition: data.itemCondition ?? "new",
    mainImageAlt: data.mainImageAlt ?? undefined,
    material: data.material ?? undefined,
    metaDescription: data.metaDescription ?? undefined,
    model: data.model ?? undefined,
    mpn: data.mpn ?? undefined,
    name: data.name,
    optionDefinitions: data.optionDefinitions ?? undefined,
    originalPrice,
    pageLayout: data.pageLayout ?? undefined,
    pageTitle: data.pageTitle ?? undefined,
    price,
    priceValidUntil: data.priceValidUntil ?? undefined,
    rating: data.rating?.average ?? 0,
    reviewCount: data.rating?.count ?? 0,
    reviews: data.rating?.recent,
    shipsFrom: data.shipsFrom ?? null,
    shipsFromCountry: data.shipsFromCountry ?? undefined,
    shippingHeightCm: data.shippingHeightCm ?? undefined,
    shippingLengthCm: data.shippingLengthCm ?? undefined,
    shippingWidthCm: data.shippingWidthCm ?? undefined,
    size: data.size ?? undefined,
    sizeChart: data.sizeChart ?? undefined,
    slug: data.slug,
    specs: {},
    transitDaysMax: data.transitDaysMax ?? undefined,
    transitDaysMin: data.transitDaysMin ?? undefined,
    variants: data.variants ?? undefined,
    weightGrams: data.weightGrams ?? undefined,
  };
}

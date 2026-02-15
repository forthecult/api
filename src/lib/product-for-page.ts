/**
 * Single source for storefront product detail page data.
 * Used by both /products/[id] and [slug] to avoid duplicate fetch/mapping logic.
 */

import type { ProductBySlugResult } from "~/lib/product-by-slug";

/** Product shape for the storefront product detail page (both /products/[id] and [slug]). */
export interface PageProduct {
  id: string;
  slug?: string;
  name: string;
  description: string;
  features: string[];
  image: string;
  images?: string[];
  mainImageAlt?: string | null;
  inStock: boolean;
  continueSellingWhenOutOfStock?: boolean;
  originalPrice?: number;
  price: number;
  rating: number;
  specs: Record<string, string>;
  category: string;
  hasVariants?: boolean;
  optionDefinitions?: { name: string; values: string[] }[];
  variants?: Array<{
    id: string;
    size?: string;
    color?: string;
    gender?: string;
    label?: string;
    priceCents: number;
    stockQuantity?: number;
    imageUrl?: string;
  }>;
  shipsFrom?: string | null;
  handlingDaysMin?: number | null;
  handlingDaysMax?: number | null;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  availableCountryCodes?: string[];
  brand?: string | null;
  model?: string | null;
  metaDescription?: string | null;
  pageTitle?: string | null;
  pageLayout?: string | null;
  sizeChart?: {
    displayName: string;
    dataImperial: unknown;
    dataMetric: unknown;
  } | null;
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
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? "",
    features: data.features ?? [],
    image: data.imageUrl ?? PLACEHOLDER_IMAGE,
    images,
    mainImageAlt: data.mainImageAlt ?? undefined,
    inStock: data.inStock ?? true,
    continueSellingWhenOutOfStock: data.continueSellingWhenOutOfStock ?? false,
    originalPrice,
    price,
    rating: 0,
    specs: {},
    category: data.category ?? "Uncategorized",
    hasVariants: data.hasVariants ?? false,
    optionDefinitions: data.optionDefinitions ?? undefined,
    variants: data.variants ?? undefined,
    shipsFrom: data.shipsFrom ?? null,
    handlingDaysMin: data.handlingDaysMin ?? undefined,
    handlingDaysMax: data.handlingDaysMax ?? undefined,
    transitDaysMin: data.transitDaysMin ?? undefined,
    transitDaysMax: data.transitDaysMax ?? undefined,
    availableCountryCodes: data.availableCountryCodes ?? [],
    brand: data.brand ?? undefined,
    model: data.model ?? undefined,
    metaDescription: data.metaDescription ?? undefined,
    pageTitle: data.pageTitle ?? undefined,
    pageLayout: data.pageLayout ?? undefined,
    sizeChart: data.sizeChart ?? undefined,
  };
}

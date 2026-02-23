/**
 * Single source for storefront product detail page data.
 * Used by both /products/[id] and [slug] to avoid duplicate fetch/mapping logic.
 */

import type { ProductBySlugResult } from "~/lib/product-by-slug";

/** Product shape for the storefront product detail page (both /products/[id] and [slug]). */
export interface PageProduct {
  availableCountryCodes?: string[];
  brand?: null | string;
  category: string;
  continueSellingWhenOutOfStock?: boolean;
  description: string;
  features: string[];
  handlingDaysMax?: null | number;
  handlingDaysMin?: null | number;
  hasVariants?: boolean;
  id: string;
  image: string;
  imageAlts?: (null | string)[];
  images?: string[];
  inStock: boolean;
  mainImageAlt?: null | string;
  metaDescription?: null | string;
  model?: null | string;
  name: string;
  optionDefinitions?: { name: string; values: string[] }[];
  originalPrice?: number;
  pageLayout?: null | string;
  pageTitle?: null | string;
  price: number;
  rating: number;
  shipsFrom?: null | string;
  sizeChart?: null | {
    dataImperial: unknown;
    dataMetric: unknown;
    displayName: string;
  };
  slug?: string;
  specs: Record<string, string>;
  transitDaysMax?: null | number;
  transitDaysMin?: null | number;
  variants?: {
    color?: string;
    gender?: string;
    id: string;
    imageUrl?: string;
    label?: string;
    priceCents: number;
    size?: string;
    stockQuantity?: number;
  }[];
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
    availableCountryCodes: data.availableCountryCodes ?? [],
    brand: data.brand ?? undefined,
    category: data.category ?? "Uncategorized",
    continueSellingWhenOutOfStock: data.continueSellingWhenOutOfStock ?? false,
    description: data.description ?? "",
    features: data.features ?? [],
    handlingDaysMax: data.handlingDaysMax ?? undefined,
    handlingDaysMin: data.handlingDaysMin ?? undefined,
    hasVariants: data.hasVariants ?? false,
    id: data.id,
    image: data.imageUrl ?? PLACEHOLDER_IMAGE,
    imageAlts: data.imageAlts,
    images,
    inStock: data.inStock ?? true,
    mainImageAlt: data.mainImageAlt ?? undefined,
    metaDescription: data.metaDescription ?? undefined,
    model: data.model ?? undefined,
    name: data.name,
    optionDefinitions: data.optionDefinitions ?? undefined,
    originalPrice,
    pageLayout: data.pageLayout ?? undefined,
    pageTitle: data.pageTitle ?? undefined,
    price,
    rating: 0,
    shipsFrom: data.shipsFrom ?? null,
    sizeChart: data.sizeChart ?? undefined,
    slug: data.slug,
    specs: {},
    transitDaysMax: data.transitDaysMax ?? undefined,
    transitDaysMin: data.transitDaysMin ?? undefined,
    variants: data.variants ?? undefined,
  };
}

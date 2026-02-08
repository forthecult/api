/**
 * Server-side only: get published product by slug or id from the database.
 * Used by the storefront [slug] page (no self-fetch) and by the products API.
 */

import { and, asc, eq, or } from "drizzle-orm";

import { db } from "~/db";
import {
  categoriesTable,
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productVariantsTable,
  productsTable,
  sizeChartsTable,
} from "~/db/schema";

type OptionDefinition = { name: string; values: string[] };

export type ProductBySlugResult = {
  id: string;
  name: string;
  description?: string;
  price: { usd: number; crypto: Record<string, string> };
  compareAtPriceCents?: number;
  imageUrl?: string;
  mainImageAlt?: string | null;
  images?: string[];
  category: string;
  inStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  /** When true, product can be purchased regardless of stock (POD/made-to-order). */
  continueSellingWhenOutOfStock: boolean;
  slug?: string;
  availableCountryCodes: string[];
  /** Bullet-point features for product page. */
  features?: string[];
  hasVariants: boolean;
  optionDefinitions?: OptionDefinition[];
  /** Ships from: full display string or composed from city/region/postal/country. Used for display and future shipping-time estimates. */
  shipsFrom?: string;
  /** Fulfillment (handling) days min/max from Printify, Printful, or manual. Used for estimated delivery timeline. */
  handlingDaysMin?: number | null;
  handlingDaysMax?: number | null;
  /** Transit (shipping) days min/max. Fallback used in UI if null. */
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  /** Blank product brand (for size chart lookup). */
  brand?: string | null;
  /** Blank product model (for size chart lookup). */
  model?: string | null;
  /** Product source: printful | printify | manual. */
  source?: string;
  metaDescription?: string | null;
  pageTitle?: string | null;
  /** When product has brand+model and a size chart exists, for accordion "Size Guide". */
  sizeChart?: {
    displayName: string;
    dataImperial: unknown;
    dataMetric: unknown;
  } | null;
  /** Product page layout: "default" or "long-form". */
  pageLayout?: string | null;
  variants?: Array<{
    id: string;
    size?: string;
    color?: string;
    priceCents: number;
    stockQuantity?: number;
    imageUrl?: string;
  }>;
};

/**
 * Look up a published product by slug or id. Returns null if not found or not published.
 */
export async function getProductBySlugOrId(
  slugOrId: string,
): Promise<ProductBySlugResult | null> {
  const slug = slugOrId?.trim();
  if (!slug) return null;

  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      featuresJson: productsTable.featuresJson,
      priceCents: productsTable.priceCents,
      compareAtPriceCents: productsTable.compareAtPriceCents,
      imageUrl: productsTable.imageUrl,
      mainImageAlt: productsTable.mainImageAlt,
      slug: productsTable.slug,
      published: productsTable.published,
      hasVariants: productsTable.hasVariants,
      optionDefinitionsJson: productsTable.optionDefinitionsJson,
      shipsFromDisplay: productsTable.shipsFromDisplay,
      shipsFromCountry: productsTable.shipsFromCountry,
      shipsFromRegion: productsTable.shipsFromRegion,
      shipsFromCity: productsTable.shipsFromCity,
      shipsFromPostalCode: productsTable.shipsFromPostalCode,
      handlingDaysMin: productsTable.handlingDaysMin,
      handlingDaysMax: productsTable.handlingDaysMax,
      transitDaysMin: productsTable.transitDaysMin,
      transitDaysMax: productsTable.transitDaysMax,
      brand: productsTable.brand,
      model: productsTable.model,
      metaDescription: productsTable.metaDescription,
      pageTitle: productsTable.pageTitle,
      pageLayout: productsTable.pageLayout,
      source: productsTable.source,
      // Stock management fields
      trackQuantity: productsTable.trackQuantity,
      continueSellingWhenOutOfStock: productsTable.continueSellingWhenOutOfStock,
      quantity: productsTable.quantity,
    })
    .from(productsTable)
    .where(or(eq(productsTable.id, slug), eq(productsTable.slug, slug)))
    .limit(1);

  if (!product || !product.published) return null;

  const id = product.id;
  const productSlug = product.slug ?? product.id;

  const [mainCat, availableCountries, variantsRows, imagesRows] =
    await Promise.all([
      db
        .select({ categoryName: categoriesTable.name })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(
          and(
            eq(productCategoriesTable.productId, product.id),
            eq(productCategoriesTable.isMain, true),
          ),
        )
        .limit(1),
      db
        .select({ countryCode: productAvailableCountryTable.countryCode })
        .from(productAvailableCountryTable)
        .where(eq(productAvailableCountryTable.productId, product.id)),
      product.hasVariants
        ? db
            .select({
              id: productVariantsTable.id,
              size: productVariantsTable.size,
              color: productVariantsTable.color,
              gender: productVariantsTable.gender,
              priceCents: productVariantsTable.priceCents,
              stockQuantity: productVariantsTable.stockQuantity,
              imageUrl: productVariantsTable.imageUrl,
            })
            .from(productVariantsTable)
            .where(eq(productVariantsTable.productId, id))
        : Promise.resolve([]),
      db
        .select({ url: productImagesTable.url })
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, id))
        .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id)),
    ]);

  const availableCountryCodes = availableCountries.map((r) => r.countryCode);

  let optionDefinitions: OptionDefinition[] = [];
  if (product.hasVariants && product.optionDefinitionsJson) {
    try {
      const parsed = JSON.parse(product.optionDefinitionsJson) as unknown;
      if (Array.isArray(parsed)) {
        optionDefinitions = parsed.filter(
          (o): o is OptionDefinition =>
            o != null &&
            typeof o === "object" &&
            typeof (o as OptionDefinition).name === "string" &&
            Array.isArray((o as OptionDefinition).values),
        );
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const variants =
    product.hasVariants && variantsRows.length > 0
      ? variantsRows.map((v) => ({
          id: v.id,
          size: v.size ?? undefined,
          color: v.color ?? undefined,
          gender: v.gender ?? undefined,
          priceCents: v.priceCents,
          stockQuantity: v.stockQuantity ?? undefined,
          imageUrl: v.imageUrl ?? undefined,
        }))
      : undefined;

  const basePriceUsd = product.priceCents / 100;

  // Stock calculation logic:
  // 1. If continueSellingWhenOutOfStock is true, always in stock (POD/made-to-order products)
  // 2. If trackQuantity is false, assume in stock (no inventory tracking)
  // 3. Otherwise, check actual stock quantities
  const continueSellingWhenOutOfStock = product.continueSellingWhenOutOfStock;
  const trackQuantity = product.trackQuantity;

  let inStock: boolean;
  let stockStatus: "in_stock" | "low_stock" | "out_of_stock";

  if (continueSellingWhenOutOfStock) {
    // POD products or products marked to continue selling - always available
    inStock = true;
    stockStatus = "in_stock";
  } else if (!trackQuantity) {
    // Not tracking inventory - assume in stock
    inStock = true;
    stockStatus = "in_stock";
  } else if (product.hasVariants) {
    // Check variant stock quantities
    const hasStock = variants?.some((v) => (v.stockQuantity ?? 0) > 0) ?? false;
    const hasLowStock = variants?.some(
      (v) => (v.stockQuantity ?? 0) > 0 && (v.stockQuantity ?? 0) < 5,
    );
    inStock = hasStock;
    stockStatus = !hasStock
      ? "out_of_stock"
      : hasLowStock
        ? "low_stock"
        : "in_stock";
  } else {
    // Simple product - check product quantity
    const qty = product.quantity ?? 0;
    inStock = qty > 0;
    stockStatus = qty === 0 ? "out_of_stock" : qty < 5 ? "low_stock" : "in_stock";
  }

  const imageUrls = imagesRows
    .map((r) => r.url)
    .filter((u): u is string => Boolean(u));

  // Size chart for accordion when product has brand+model (printful, printify, or manual)
  let sizeChart: { displayName: string; dataImperial: unknown; dataMetric: unknown } | null = null;
  if (product.brand?.trim() && product.model?.trim()) {
    const provider = product.source === "printful" || product.source === "printify" ? product.source : "manual";
    const [chartRow] = await db
      .select({
        displayName: sizeChartsTable.displayName,
        dataImperial: sizeChartsTable.dataImperial,
        dataMetric: sizeChartsTable.dataMetric,
      })
      .from(sizeChartsTable)
      .where(
        and(
          eq(sizeChartsTable.provider, provider),
          eq(sizeChartsTable.brand, product.brand.trim()),
          eq(sizeChartsTable.model, product.model.trim()),
        ),
      )
      .limit(1);
    if (chartRow && (chartRow.dataImperial != null || chartRow.dataMetric != null)) {
      sizeChart = {
        displayName: chartRow.displayName,
        dataImperial: chartRow.dataImperial as unknown,
        dataMetric: chartRow.dataMetric as unknown,
      };
    }
  }

  const shipsFrom = (() => {
    if (product.shipsFromDisplay?.trim()) return product.shipsFromDisplay.trim();
    const parts = [
      product.shipsFromCity?.trim(),
      product.shipsFromRegion?.trim(),
      product.shipsFromPostalCode?.trim(),
      product.shipsFromCountry?.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : undefined;
  })();

  let features: string[] = [];
  if (product.featuresJson) {
    try {
      const parsed = JSON.parse(product.featuresJson) as unknown;
      if (Array.isArray(parsed)) {
        features = parsed.filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        );
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    price: { usd: basePriceUsd, crypto: {} },
    compareAtPriceCents: product.compareAtPriceCents ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    mainImageAlt: product.mainImageAlt ?? undefined,
    images: imageUrls.length > 0 ? imageUrls : undefined,
    category: mainCat?.[0]?.categoryName ?? "Uncategorized",
    inStock,
    stockStatus,
    continueSellingWhenOutOfStock,
    slug: product.slug ?? undefined,
    availableCountryCodes,
    features: features.length > 0 ? features : undefined,
    hasVariants: product.hasVariants ?? false,
    optionDefinitions:
      optionDefinitions.length > 0 ? optionDefinitions : undefined,
    shipsFrom,
    handlingDaysMin: product.handlingDaysMin ?? undefined,
    handlingDaysMax: product.handlingDaysMax ?? undefined,
    transitDaysMin: product.transitDaysMin ?? undefined,
    transitDaysMax: product.transitDaysMax ?? undefined,
    brand: product.brand ?? undefined,
    model: product.model ?? undefined,
    metaDescription: product.metaDescription ?? undefined,
    pageTitle: product.pageTitle ?? undefined,
    pageLayout: product.pageLayout ?? undefined,
    source: product.source ?? undefined,
    sizeChart: sizeChart ?? undefined,
    variants,
  };
}

/**
 * Server-side only: get published product by slug or id from the database.
 * Used by the storefront [slug] page (no self-fetch) and by the products API.
 */

import { and, asc, eq, ilike, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "~/db";
import {
  categoriesTable,
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  sizeChartsTable,
} from "~/db/schema";
import {
  getAmazonProduct,
  isAmazonProductApiConfigured,
} from "~/lib/amazon-product-api";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";

const AMAZON_PRICE_CACHE_MS = 15 * 60 * 1000; // 15 minutes

export interface ProductBySlugResult {
  availableCountryCodes: string[];
  /** Blank product brand (for size chart lookup). */
  brand?: null | string;
  category: string;
  compareAtPriceCents?: number;
  /** When true, product can be purchased regardless of stock (POD/made-to-order). */
  continueSellingWhenOutOfStock: boolean;
  description?: string;
  /** Bullet-point features for product page. */
  features?: string[];
  handlingDaysMax?: null | number;
  /** Fulfillment (handling) days min/max from Printify, Printful, or manual. Used for estimated delivery timeline. */
  handlingDaysMin?: null | number;
  hasVariants: boolean;
  id: string;
  /** Per-image alt text (same order as images). Used for gallery SEO when set. */
  imageAlts?: (null | string)[];
  images?: string[];
  imageUrl?: string;
  inStock: boolean;
  mainImageAlt?: null | string;
  metaDescription?: null | string;
  /** Blank product model (for size chart lookup). */
  model?: null | string;
  name: string;
  optionDefinitions?: OptionDefinition[];
  /** Product page layout: "default" or "long-form". */
  pageLayout?: null | string;
  pageTitle?: null | string;
  price: { crypto: Record<string, string>; usd: number };
  /** Ships from: full display string or composed from city/region/postal/country. Used for display and future shipping-time estimates. */
  shipsFrom?: string;
  /** When product has brand+model and a size chart exists, for accordion "Size Guide". */
  sizeChart?: null | {
    dataImperial: unknown;
    dataMetric: unknown;
    displayName: string;
  };
  slug?: string;
  /** Product source: printful | printify | manual. */
  source?: string;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  transitDaysMax?: null | number;
  /** Transit (shipping) days min/max. Fallback used in UI if null. */
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

interface OptionDefinition {
  name: string;
  values: string[];
}

/**
 * Look up a published product by slug or id. Returns null if not found or not published.
 */
export async function getProductBySlugOrId(
  slugOrId: string,
): Promise<null | ProductBySlugResult> {
  const slug = slugOrId?.trim();
  if (!slug) return null;

  const [product] = await db
    .select({
      amazonAsin: productsTable.amazonAsin,
      amazonPriceRefreshedAt: productsTable.amazonPriceRefreshedAt,
      brand: productsTable.brand,
      compareAtPriceCents: productsTable.compareAtPriceCents,
      continueSellingWhenOutOfStock:
        productsTable.continueSellingWhenOutOfStock,
      description: productsTable.description,
      featuresJson: productsTable.featuresJson,
      handlingDaysMax: productsTable.handlingDaysMax,
      handlingDaysMin: productsTable.handlingDaysMin,
      hasVariants: productsTable.hasVariants,
      id: productsTable.id,
      imageUrl: productsTable.imageUrl,
      mainImageAlt: productsTable.mainImageAlt,
      metaDescription: productsTable.metaDescription,
      model: productsTable.model,
      name: productsTable.name,
      optionDefinitionsJson: productsTable.optionDefinitionsJson,
      pageLayout: productsTable.pageLayout,
      pageTitle: productsTable.pageTitle,
      priceCents: productsTable.priceCents,
      published: productsTable.published,
      quantity: productsTable.quantity,
      shipsFromCity: productsTable.shipsFromCity,
      shipsFromCountry: productsTable.shipsFromCountry,
      shipsFromDisplay: productsTable.shipsFromDisplay,
      shipsFromPostalCode: productsTable.shipsFromPostalCode,
      shipsFromRegion: productsTable.shipsFromRegion,
      slug: productsTable.slug,
      source: productsTable.source,
      // Stock management fields
      trackQuantity: productsTable.trackQuantity,
      transitDaysMax: productsTable.transitDaysMax,
      transitDaysMin: productsTable.transitDaysMin,
    })
    .from(productsTable)
    .where(or(eq(productsTable.id, slug), eq(productsTable.slug, slug)))
    .limit(1);

  if (!product?.published) return null;

  // for amazon products, refresh price if stale (> 15 min)
  let priceCents = product.priceCents;
  if (
    product.source === "amazon" &&
    product.amazonAsin &&
    isAmazonProductApiConfigured()
  ) {
    const lastRefresh = product.amazonPriceRefreshedAt?.getTime() ?? 0;
    const now = Date.now();
    if (now - lastRefresh > AMAZON_PRICE_CACHE_MS) {
      try {
        const fresh = await getAmazonProduct(product.amazonAsin);
        if (fresh && fresh.price.usd > 0) {
          const freshPriceCents = Math.round(fresh.price.usd * 100);
          priceCents = freshPriceCents;
          // update in background (don't block response)
          db.update(productsTable)
            .set({
              amazonPriceRefreshedAt: new Date(),
              imageUrl: fresh.imageUrl ?? product.imageUrl,
              priceCents: freshPriceCents,
              updatedAt: new Date(),
            })
            .where(eq(productsTable.id, product.id))
            .execute()
            .catch((err) =>
              console.error("Failed to update Amazon price:", err),
            );
        }
      } catch (err) {
        console.error("Failed to refresh Amazon price:", err);
        // use cached price
      }
    }
  }

  const id = product.id;
  const _productSlug = product.slug ?? product.id;

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
      // Always fetch variant rows so we show variants even if hasVariants flag was wrong (e.g. Printful sync)
      db
        .select({
          color: productVariantsTable.color,
          gender: productVariantsTable.gender,
          id: productVariantsTable.id,
          imageUrl: productVariantsTable.imageUrl,
          label: productVariantsTable.label,
          priceCents: productVariantsTable.priceCents,
          size: productVariantsTable.size,
          stockQuantity: productVariantsTable.stockQuantity,
        })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, id)),
      db
        .select({
          alt: productImagesTable.alt,
          url: productImagesTable.url,
        })
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, id))
        .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id)),
    ]);

  const availableCountryCodes = availableCountries.map((r) => r.countryCode);

  let optionDefinitions: OptionDefinition[] = [];
  if (product.optionDefinitionsJson) {
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
  const hasVariantRows = variantsRows.length > 0;

  // Merge duplicate option names (e.g. two "Size" entries) so each dimension has one row and one selection.
  optionDefinitions = mergeOptionDefinitionsByName(optionDefinitions);

  // Product has option definitions (e.g. from Printful sync) but no variant rows yet — admin sees
  // Options (Size, Color) from JSON; customer section requires variant rows. Create variant rows
  // from the Cartesian product of option values so storefront shows the same as admin (no external sync).
  if (!hasVariantRows && optionDefinitions.length > 0) {
    const created = await createVariantRowsFromOptionDefinitions(
      id,
      product.priceCents,
      optionDefinitions,
    );
    if (created) return getProductBySlugOrId(slugOrId);
  }

  // When we have variant rows but no option definitions (e.g. legacy sync), derive from variant data.
  // Use "Option" for the gender column: it holds "other" options (Grind, Device, Model, etc.), not just Gender.
  // Re-sync from Printify/Printful to restore real labels (e.g. "Grind", "Size") in optionDefinitionsJson.
  if (hasVariantRows && optionDefinitions.length === 0) {
    const sizeValues = new Set<string>();
    const colorValues = new Set<string>();
    const otherOptionValues = new Set<string>();
    const labelValues = new Set<string>();
    for (const v of variantsRows) {
      if (v.size?.trim()) sizeValues.add(v.size.trim());
      if (v.color?.trim()) colorValues.add(v.color.trim());
      if (v.gender?.trim()) otherOptionValues.add(v.gender.trim());
      if (v.label?.trim()) labelValues.add(v.label.trim());
    }
    if (colorValues.size > 0)
      optionDefinitions.push({
        name: "Color",
        values: [...colorValues].sort(),
      });
    if (otherOptionValues.size > 0)
      optionDefinitions.push({
        name: "Option",
        values: [...otherOptionValues].sort(),
      });
    if (sizeValues.size > 0)
      optionDefinitions.push({
        name: "Size",
        values: sortClothingSizes([...sizeValues]),
      });
    if (optionDefinitions.length === 0 && labelValues.size > 0)
      optionDefinitions.push({
        name: "Variant",
        values: [...labelValues].sort(),
      });
  }

  const variants = hasVariantRows
    ? variantsRows.map((v) => ({
        color: v.color ?? undefined,
        gender: v.gender ?? undefined,
        id: v.id,
        imageUrl: v.imageUrl ?? undefined,
        label: v.label ?? undefined,
        priceCents: v.priceCents,
        size: v.size ?? undefined,
        stockQuantity: v.stockQuantity ?? undefined,
      }))
    : undefined;

  const basePriceUsd = priceCents / 100;

  // Stock calculation logic:
  // 1. If continueSellingWhenOutOfStock is true, always in stock (POD/made-to-order products)
  // 2. If product has variants, product-level stock is derived from variant stock only (so "In Stock" matches at least one variant)
  // 3. If trackQuantity is false (simple product only), assume in stock
  // 4. Otherwise, check simple product quantity
  const continueSellingWhenOutOfStock = product.continueSellingWhenOutOfStock;
  const trackQuantity = product.trackQuantity;

  let inStock: boolean;
  let stockStatus: "in_stock" | "low_stock" | "out_of_stock";

  if (continueSellingWhenOutOfStock) {
    // POD products or products marked to continue selling - always available
    inStock = true;
    stockStatus = "in_stock";
  } else if (hasVariantRows && variants && variants.length > 0) {
    // Products with variants: product is in stock only if at least one variant has stock
    const hasStock = variants.some((v) => (v.stockQuantity ?? 0) > 0);
    const hasLowStock = variants.some(
      (v) => (v.stockQuantity ?? 0) > 0 && (v.stockQuantity ?? 0) < 5,
    );
    inStock = hasStock;
    stockStatus = !hasStock
      ? "out_of_stock"
      : hasLowStock
        ? "low_stock"
        : "in_stock";
  } else if (!trackQuantity) {
    // Simple product, not tracking inventory - assume in stock
    inStock = true;
    stockStatus = "in_stock";
  } else {
    // Simple product - check product quantity
    const qty = product.quantity ?? 0;
    inStock = qty > 0;
    stockStatus =
      qty === 0 ? "out_of_stock" : qty < 5 ? "low_stock" : "in_stock";
  }

  const imageUrls: string[] = [];
  const imageAlts: (null | string)[] = [];
  for (const r of imagesRows) {
    if (r.url?.trim()) {
      imageUrls.push(r.url.trim());
      imageAlts.push(r.alt?.trim() || null);
    }
  }

  // Size chart for accordion when product has brand+model (printful, printify, or manual)
  let sizeChart: null | {
    dataImperial: unknown;
    dataMetric: unknown;
    displayName: string;
  } = null;
  if (product.brand?.trim() && product.model?.trim()) {
    const provider =
      product.source === "printful" || product.source === "printify"
        ? product.source
        : "manual";
    const brandTrim = product.brand.trim();
    const modelTrim = product.model.trim();
    let [chartRow] = await db
      .select({
        dataImperial: sizeChartsTable.dataImperial,
        dataMetric: sizeChartsTable.dataMetric,
        displayName: sizeChartsTable.displayName,
      })
      .from(sizeChartsTable)
      .where(
        and(
          eq(sizeChartsTable.provider, provider),
          eq(sizeChartsTable.brand, brandTrim),
          eq(sizeChartsTable.model, modelTrim),
        ),
      )
      .limit(1);
    // Fallback: case-insensitive match when exact match misses (e.g. DB has different casing)
    if (!chartRow) {
      [chartRow] = await db
        .select({
          dataImperial: sizeChartsTable.dataImperial,
          dataMetric: sizeChartsTable.dataMetric,
          displayName: sizeChartsTable.displayName,
        })
        .from(sizeChartsTable)
        .where(
          and(
            eq(sizeChartsTable.provider, provider),
            ilike(sizeChartsTable.brand, brandTrim),
            ilike(sizeChartsTable.model, modelTrim),
          ),
        )
        .limit(1);
    }
    if (
      chartRow &&
      (chartRow.dataImperial != null || chartRow.dataMetric != null)
    ) {
      sizeChart = {
        dataImperial: chartRow.dataImperial as unknown,
        dataMetric: chartRow.dataMetric as unknown,
        displayName: chartRow.displayName,
      };
    }
  }

  const shipsFrom = (() => {
    if (product.shipsFromDisplay?.trim())
      return product.shipsFromDisplay.trim();
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
    availableCountryCodes,
    brand: product.brand ?? undefined,
    category: mainCat?.[0]?.categoryName ?? "Uncategorized",
    compareAtPriceCents: product.compareAtPriceCents ?? undefined,
    continueSellingWhenOutOfStock,
    description: product.description ?? undefined,
    features: features.length > 0 ? features : undefined,
    handlingDaysMax: product.handlingDaysMax ?? undefined,
    handlingDaysMin: product.handlingDaysMin ?? undefined,
    hasVariants: hasVariantRows || (product.hasVariants ?? false),
    id: product.id,
    imageAlts: imageUrls.length > 0 ? imageAlts : undefined,
    images: imageUrls.length > 0 ? imageUrls : undefined,
    imageUrl: product.imageUrl ?? undefined,
    inStock,
    mainImageAlt: product.mainImageAlt ?? undefined,
    metaDescription: product.metaDescription ?? undefined,
    model: product.model ?? undefined,
    name: product.name,
    optionDefinitions:
      optionDefinitions.length > 0 ? optionDefinitions : undefined,
    pageLayout: product.pageLayout ?? undefined,
    pageTitle: product.pageTitle ?? undefined,
    price: { crypto: {}, usd: basePriceUsd },
    shipsFrom,
    sizeChart: sizeChart ?? undefined,
    slug: product.slug ?? undefined,
    source: product.source ?? undefined,
    stockStatus,
    transitDaysMax: product.transitDaysMax ?? undefined,
    transitDaysMin: product.transitDaysMin ?? undefined,
    variants,
  };
}

/**
 * Create variant rows from option definitions (Cartesian product) when a product has options
 * (e.g. from Printful) but no variant rows — so the storefront shows size/color like the admin.
 * Returns true if any rows were inserted.
 */
async function createVariantRowsFromOptionDefinitions(
  productId: string,
  priceCents: number,
  optionDefinitions: OptionDefinition[],
): Promise<boolean> {
  const valid = optionDefinitions.filter(
    (o) =>
      o.name?.trim() && o.values?.length && o.values.some((v) => v?.trim()),
  );
  if (valid.length === 0) return false;

  const combinations: Record<string, string>[] = [{}];
  for (const opt of valid) {
    const next: Record<string, string>[] = [];
    const name = opt.name.trim();
    const values = opt.values.map((v) => v?.trim()).filter(Boolean);
    for (const combo of combinations) {
      for (const value of values) {
        next.push({ ...combo, [name]: value });
      }
    }
    combinations.length = 0;
    combinations.push(...next);
  }

  if (combinations.length === 0) return false;

  const now = new Date();

  for (const combo of combinations) {
    const size = combo.Size ?? combo.size ?? null;
    const color = combo.Color ?? combo.color ?? null;
    const gender = combo.Gender ?? combo.gender ?? null;
    const label =
      Object.entries(combo)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ") || null;

    await db.insert(productVariantsTable).values({
      color,
      createdAt: now,
      gender,
      id: nanoid(),
      label,
      priceCents,
      productId,
      size,
      updatedAt: now,
    });
  }

  return true;
}

/**
 * Merge option definitions that share the same name so each dimension (e.g. Size)
 * has exactly one row and one selection. Fixes products where duplicate names
 * (e.g. two "Size" entries) would require two selections that no single variant satisfies.
 */
function mergeOptionDefinitionsByName(
  optionDefinitions: OptionDefinition[],
): OptionDefinition[] {
  if (optionDefinitions.length <= 1) return optionDefinitions;
  const byName = new Map<string, string[]>();
  const order: string[] = [];
  for (const opt of optionDefinitions) {
    const name = opt.name?.trim() || "Option";
    const values = (opt.values ?? [])
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (!byName.has(name)) {
      order.push(name);
      byName.set(name, []);
    }
    const existing = byName.get(name)!;
    for (const v of values) {
      if (!existing.includes(v)) existing.push(v);
    }
  }
  return order.map((name) => {
    const values = byName.get(name)!;
    const isSize = name.toLowerCase() === "size";
    return {
      name,
      values: isSize ? sortClothingSizes([...values]) : [...values].sort(),
    };
  });
}

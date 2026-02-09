/**
 * Printful Product Synchronization Service
 *
 * Handles bidirectional synchronization between Printful Sync Products and local database:
 * - Import: Pull sync products from Printful → create/update local products
 * - Export: Push local product changes → update Printful (price, description)
 *
 * Printful's sync products are "finished" products with your designs applied to
 * blank catalog items. This service syncs those finished products to your store.
 */

import { eq, and, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "~/db";
import {
  productAvailableCountryTable,
  productsTable,
  productVariantsTable,
  productImagesTable,
  sizeChartsTable,
} from "~/db/schema";
import { applyCategoryAutoRules } from "~/lib/category-auto-assign";
import { POD_SHIPPING_COUNTRY_CODES } from "~/lib/pod-shipping-countries";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import {
  fetchSyncProducts,
  fetchSyncProduct,
  fetchCatalogProduct,
  fetchCatalogProductShippingCountries,
  fetchCatalogProductShippingCustoms,
  fetchProductSizeGuideSafe,
  fetchVariantPrices,
  updateSyncProduct,
  updateSyncVariant,
  getPrintfulIfConfigured,
  type PrintfulSyncProduct,
  type PrintfulSyncProductFull,
  type PrintfulSyncVariant,
} from "./printful";

// ============================================================================
// Types
// ============================================================================

export type SyncResult = {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export type ProductExportResult = {
  success: boolean;
  printfulSyncProductId?: number;
  error?: string;
};

// ============================================================================
// Import: Printful → Backend
// ============================================================================

/**
 * Import all sync products from Printful to local database.
 * Creates new products or updates existing ones based on printfulSyncProductId.
 */
export async function importAllPrintfulProducts(
  options: {
    /** Only import products in "synced" status */
    syncedOnly?: boolean;
    /** Overwrite existing product data (name, description, etc.) */
    overwriteExisting?: boolean;
  } = {},
): Promise<SyncResult> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Printful not configured"],
    };
  }

  const result: SyncResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Fetch all sync products (paginated)
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { products, paging } = await fetchSyncProducts({
        status: options.syncedOnly ? "synced" : "all",
        offset,
        limit,
      });

      for (const syncProduct of products) {
        try {
          const importResult = await importSinglePrintfulProduct(
            syncProduct.id,
            options.overwriteExisting ?? false,
          );
          if (importResult.action === "imported") {
            result.imported++;
          } else if (importResult.action === "updated") {
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(
            `Product ${syncProduct.id} (${syncProduct.name}): ${message}`,
          );
        }
      }

      offset += products.length;
      hasMore = offset < paging.total;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch products: ${message}`);
    result.success = false;
  }

  return result;
}

/**
 * Backfill size charts for all existing Printful products.
 * Fetches size guides from Printful for each distinct catalog product (brand+model) and upserts into size_chart.
 * Call this after a resync if size charts were not imported (e.g. products were skipped).
 */
export async function importSizeChartsForAllPrintfulProducts(): Promise<{
  success: boolean;
  upserted: number;
  errors: string[];
}> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { success: false, upserted: 0, errors: ["Printful not configured"] };
  }

  const errors: string[] = [];
  let upserted = 0;

  try {
    const rows = await db
      .select({
        externalId: productsTable.externalId,
        brand: productsTable.brand,
        model: productsTable.model,
      })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.source, "printful"),
          isNotNull(productsTable.printfulSyncProductId),
          isNotNull(productsTable.externalId),
        ),
      );

    const seen = new Set<string>();
    for (const row of rows) {
      const catalogProductId =
        row.externalId != null
          ? Number.parseInt(String(row.externalId), 10)
          : NaN;
      if (!Number.isFinite(catalogProductId) || catalogProductId <= 0) continue;

      const brand = (row.brand?.trim() || "Printful").trim() || "Printful";
      const model =
        (row.model?.trim() || String(catalogProductId)).trim() ||
        String(catalogProductId);
      const key = `${brand}|${model}`;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        await upsertPrintfulSizeChart(catalogProductId, brand, model);
        upserted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Catalog ${catalogProductId} (${brand} / ${model}): ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      upserted,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, upserted, errors: [message] };
  }
}

/**
 * Import size chart for a single Printful product by our product id.
 * Uses the product's stored externalId (catalog product id), brand, and model.
 * Call this after a single-product resync to ensure the size chart is pulled even if the in-flow import was skipped or failed.
 */
export async function importSizeChartForPrintfulProduct(
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { success: false, error: "Printful not configured" };
  }

  const [row] = await db
    .select({
      source: productsTable.source,
      externalId: productsTable.externalId,
      brand: productsTable.brand,
      model: productsTable.model,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!row || row.source !== "printful" || row.externalId == null) {
    return {
      success: false,
      error: "Product not found or is not a Printful product with catalog id",
    };
  }

  const catalogProductId = Number.parseInt(String(row.externalId), 10);
  if (!Number.isFinite(catalogProductId) || catalogProductId <= 0) {
    return { success: false, error: "Invalid catalog product id" };
  }

  const brand = (row.brand?.trim() || "Printful").trim() || "Printful";
  const model =
    (row.model?.trim() || String(catalogProductId)).trim() ||
    String(catalogProductId);

  try {
    const upserted = await upsertPrintfulSizeChart(catalogProductId, brand, model);
    return upserted
      ? { success: true }
      : { success: false, error: "Printful returned no size guide for this catalog product" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Import a single Printful sync product by ID.
 * When admin runs sync, we retry if Printful returns no variants (they often need a few seconds after publish).
 */
const PRINTFUL_VARIANT_RETRY_DELAYS_MS = [2000, 5000, 10000];

export async function importSinglePrintfulProduct(
  printfulSyncProductId: number,
  overwriteExisting = false,
): Promise<{ action: "imported" | "updated" | "skipped"; productId: string }> {
  // Fetch full product details including variants. Printful often returns empty sync_variants
  // right after publish; retry with delays so admin sync reliably gets size/color for the storefront.
  let syncProductFull = await fetchSyncProduct(printfulSyncProductId);
  let { sync_product: syncProduct, sync_variants: syncVariants } =
    syncProductFull;
  if (syncVariants.length === 0 && syncProduct.variants > 0) {
    for (const delayMs of PRINTFUL_VARIANT_RETRY_DELAYS_MS) {
      await new Promise((r) => setTimeout(r, delayMs));
      syncProductFull = await fetchSyncProduct(printfulSyncProductId);
      syncVariants = syncProductFull.sync_variants;
      if (syncVariants.length > 0) break;
    }
    if (syncVariants.length === 0) {
      console.warn(
        `Printful product ${printfulSyncProductId}: sync_variants still empty after retries (expected ${syncProduct.variants}). Product will be created/updated without variants; run sync again later to get size/color.`,
      );
    }
  }

  // Fetch catalog product for description/brand/model and shipping/customs. Brand/model required for size chart + product page.
  let catalogProduct: {
    brand: string;
    model: string;
    description: string | null;
    countryOfOrigin: string | null;
    hsCode: string | null;
  } | null = null;
  const catalogProductId = syncVariants[0]?.product?.product_id;
  if (catalogProductId != null) {
    try {
      const [catalog, customs] = await Promise.all([
        fetchCatalogProduct(catalogProductId),
        fetchCatalogProductShippingCustoms(catalogProductId),
      ]);
      if (catalog?.data) {
        // Fallback so we always have brand/model for size_chart and product (Printful may omit for some catalog items)
        const brand = (catalog.data.brand ?? "Printful").trim() || "Printful";
        const model = (catalog.data.model ?? String(catalogProductId)).trim() || String(catalogProductId);
        catalogProduct = {
          brand,
          model,
          description: catalog.data.description ?? null,
          countryOfOrigin: customs.countryOfOrigin,
          hsCode: customs.hsCode,
        };
      } else {
        catalogProduct = {
          brand: "Printful",
          model: String(catalogProductId),
          description: null,
          countryOfOrigin: null,
          hsCode: null,
        };
      }
    } catch (err) {
      console.warn("Printful catalog fetch failed for product", catalogProductId, err);
      catalogProduct = {
        brand: "Printful",
        model: String(catalogProductId),
        description: null,
        countryOfOrigin: null,
        hsCode: null,
      };
    }
  }

  // Check if we already have this product
  const [existingProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.printfulSyncProductId, printfulSyncProductId))
    .limit(1);

  if (existingProduct) {
    if (!overwriteExisting) {
      // Still ensure size chart exists for this brand/model (import once per brand/model)
      if (catalogProductId != null && catalogProduct) {
        await upsertPrintfulSizeChart(
          catalogProductId,
          catalogProduct.brand,
          catalogProduct.model,
        ).catch((err) => {
          console.warn(
            "Printful size chart upsert failed on skip for product",
            existingProduct.id,
            err,
          );
        });
      }
      return { action: "skipped", productId: existingProduct.id };
    }

    // Update existing product
    await updateLocalProductFromPrintful(
      existingProduct.id,
      syncProduct,
      syncVariants,
      catalogProduct,
    );
    if (catalogProductId != null && catalogProduct) {
      await upsertPrintfulSizeChart(catalogProductId, catalogProduct.brand, catalogProduct.model);
    }
    return { action: "updated", productId: existingProduct.id };
  }

  // Create new product
  const productId = await createLocalProductFromPrintful(
    syncProduct,
    syncVariants,
    catalogProduct,
  );
  if (catalogProductId != null && catalogProduct) {
    await upsertPrintfulSizeChart(catalogProductId, catalogProduct.brand, catalogProduct.model);
  }
  return { action: "imported", productId };
}

/** Coerce option value to string (Printful can return string | boolean). */
function optionValueToString(
  opt: { id?: string; value?: string | boolean } | null,
): string | null {
  if (opt == null) return null;
  const v = opt.value;
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Get size from sync variant: top-level or options array (Printful may use options only). */
function getVariantSize(v: PrintfulSyncVariant): string | null {
  if (v.size?.trim()) return v.size.trim();
  const opts = v.options ?? [];
  const idLower = (id: string | undefined) => (id ?? "").toLowerCase();
  const sizeOpt = opts.find((o) => idLower(o?.id).includes("size"));
  return optionValueToString(sizeOpt ?? null);
}

/** Get color from sync variant: top-level or options array (Printful may use options only). */
function getVariantColor(v: PrintfulSyncVariant): string | null {
  if (v.color?.trim()) return v.color.trim();
  const opts = v.options ?? [];
  const idLower = (id: string | undefined) => (id ?? "").toLowerCase();
  const colorOpt = opts.find((o) => idLower(o?.id).includes("color"));
  return optionValueToString(colorOpt ?? null);
}

/** Build option definitions (Size, Color) from sync variants for storefront and admin. Fallback to variant names when size/color not extracted. */
function buildOptionDefinitionsFromVariants(
  syncVariants: PrintfulSyncVariant[],
): Array<{ name: string; values: string[] }> {
  const sizeValues = new Set<string>();
  const colorValues = new Set<string>();
  for (const v of syncVariants) {
    const size = getVariantSize(v);
    const color = getVariantColor(v);
    if (size) sizeValues.add(size);
    if (color) colorValues.add(color);
  }
  const options: Array<{ name: string; values: string[] }> = [];
  if (sizeValues.size > 0) {
    options.push({ name: "Size", values: [...sizeValues].sort() });
  }
  if (colorValues.size > 0) {
    options.push({ name: "Color", values: [...colorValues].sort() });
  }
  if (options.length === 0 && syncVariants.length > 1) {
    const labels = new Set<string>();
    for (const v of syncVariants) {
      const name = v.name?.trim();
      if (name) labels.add(name);
    }
    if (labels.size > 0) {
      options.push({ name: "Variant", values: [...labels].sort() });
    }
  }
  return options;
}

/**
 * Get variant image URL: prefer product mockup (product-with-design) over print file (design-only).
 * Order: mockup > preview > default. Avoid using the "default" file when it's the print/design file.
 */
function getPrintfulVariantImageUrl(syncVariant: PrintfulSyncVariant): string | null {
  const files = syncVariant.files ?? [];
  const mockupOrPreview =
    files.find((f) => f.type === "mockup" || f.type === "preview") ??
    files.find((f) => f.type === "default");
  const file = mockupOrPreview ?? files[0];
  const fromFile =
    file?.preview_url || file?.thumbnail_url || file?.url || null;
  if (fromFile) return fromFile;
  return syncVariant.product?.image ?? null;
}

/**
 * Normalize Printful size guide API response to our stored JSON shape.
 * Supports: res.data (v2), res.result (v1), or direct payload (size_tables at top level).
 */
function normalizeSizeGuideData(
  res:
    | {
        data?: {
          available_sizes?: string[];
          size_tables?: Array<{
            type: string;
            unit: string;
            description?: string;
            image_url?: string;
            measurements?: unknown;
          }>;
        };
        result?: {
          available_sizes?: string[];
          size_tables?: Array<{
            type: string;
            unit: string;
            description?: string;
            image_url?: string;
            measurements?: unknown;
          }>;
        };
        available_sizes?: string[];
        size_tables?: Array<{
          type: string;
          unit: string;
          description?: string;
          image_url?: string;
          measurements?: unknown;
        }>;
      }
    | null,
): { availableSizes: string[]; sizeTables: Array<{ type: string; unit: string; description?: string; image_url?: string; measurements?: unknown }> } | null {
  type Payload = {
    available_sizes?: string[];
    size_tables?: Array<{
      type: string;
      unit: string;
      description?: string;
      image_url?: string;
      measurements?: unknown;
    }>;
  };
  const raw =
    res == null
      ? null
      : (res as { data?: Payload; result?: Payload }).data ??
        (res as { result?: Payload }).result ??
        (res as Payload);
  const payload: Payload | null = raw;
  if (!payload?.size_tables?.length) return null;
  return {
    availableSizes: payload.available_sizes ?? [],
    sizeTables: payload.size_tables.map((t) => ({
      type: t.type,
      unit: t.unit,
      description: t.description,
      image_url: t.image_url,
      measurements: t.measurements,
    })),
  };
}

/** Derive size chart display name from Printful catalog product type/name (e.g. "Hoodie" → "Hoodies", "T-Shirt" → "T-Shirts", "Shoes" → "Shoes"). */
function sizeChartDisplayNameFromCatalog(typeOrName: string | null | undefined): string {
  const raw = (typeOrName ?? "").trim();
  if (!raw) return "T-Shirts";
  const titleCased = raw
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(raw.includes("-") ? "-" : " ");
  if (!titleCased) return "T-Shirts";
  return titleCased.endsWith("s") ? titleCased : `${titleCased}s`;
}

/** Normalize Printful size guide response to our stored JSON shape and upsert size_charts for (printful, brand, model). Returns true if a size chart was upserted. */
async function upsertPrintfulSizeChart(
  catalogProductId: number,
  brand: string,
  model: string,
): Promise<boolean> {
  try {
    // Fetch catalog product for display name (type/name: e.g. Hoodie, T-Shirt, Shoes)
    let displayName = "T-Shirts";
    try {
      const catalogRes = await fetchCatalogProduct(catalogProductId);
      const catalog = catalogRes?.data;
      if (catalog?.type ?? catalog?.name) {
        displayName = sizeChartDisplayNameFromCatalog(catalog.type ?? catalog.name ?? null);
      }
    } catch {
      // keep default
    }

    // Try without unit first (some catalog products only return one format)
    const noUnitRes = await fetchProductSizeGuideSafe(catalogProductId, {});
    const fromNoUnit = normalizeSizeGuideData(noUnitRes);
    const hasImperial = fromNoUnit?.sizeTables.some((t) => t.unit !== "cm" && t.unit !== "metric");
    const hasMetric = fromNoUnit?.sizeTables.some((t) => t.unit === "cm" || t.unit === "metric");
    let dataImperial = fromNoUnit && hasImperial ? fromNoUnit : null;
    let dataMetric = fromNoUnit && hasMetric ? fromNoUnit : null;
    // If we don't have both, try explicit units in parallel
    if (dataImperial == null || dataMetric == null) {
      const [imperialRes, metricRes] = await Promise.all([
        fetchProductSizeGuideSafe(catalogProductId, { unit: "inches" }),
        fetchProductSizeGuideSafe(catalogProductId, { unit: "cm" }),
      ]);
      if (dataImperial == null) dataImperial = normalizeSizeGuideData(imperialRes);
      if (dataMetric == null) dataMetric = normalizeSizeGuideData(metricRes);
    }

    if (dataImperial == null && dataMetric == null) {
      console.warn(
        "Printful size guide empty for catalog product",
        catalogProductId,
        "brand:",
        brand,
        "model:",
        model,
      );
      return false;
    }
    const id = nanoid();
    const now = new Date();
    const brandTrimmed = brand.trim() || "Printful";
    const modelTrimmed = model.trim() || String(catalogProductId);
    await db
      .insert(sizeChartsTable)
      .values({
        id,
        provider: "printful",
        brand: brandTrimmed,
        model: modelTrimmed,
        displayName,
        dataImperial: dataImperial ? JSON.stringify(dataImperial) : null,
        dataMetric: dataMetric ? JSON.stringify(dataMetric) : null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [sizeChartsTable.provider, sizeChartsTable.brand, sizeChartsTable.model],
        set: {
          displayName,
          dataImperial: dataImperial ? JSON.stringify(dataImperial) : null,
          dataMetric: dataMetric ? JSON.stringify(dataMetric) : null,
          updatedAt: now,
        },
      });
    return true;
  } catch (err) {
    console.warn("Printful size chart import failed for catalog product", catalogProductId, err);
    return false;
  }
}

async function createLocalProductFromPrintful(
  syncProduct: PrintfulSyncProduct,
  syncVariants: PrintfulSyncVariant[],
  catalogProduct: {
    brand: string | null;
    model: string | null;
    description: string | null;
    countryOfOrigin: string | null;
    hsCode: string | null;
  } | null,
): Promise<string> {
  const productId = nanoid();
  const now = new Date();

  // Generate a unique slug from the product name
  const baseSlug = slugify(syncProduct.name);
  let slug = baseSlug;
  let slugSuffix = 1;
  while (true) {
    const [existing] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${slugSuffix++}`;
  }

  // Determine price from variants (use lowest price)
  const prices = syncVariants
    .map((v) => Number.parseFloat(v.retail_price || "0") * 100)
    .filter((p) => p > 0);
  const priceCents = prices.length > 0 ? Math.min(...prices) : 0;

  // Determine if it has multiple variants (or single variant with options like size)
  const hasVariants = syncVariants.length > 1;
  const optionDefs = buildOptionDefinitionsFromVariants(syncVariants);
  const optionDefinitionsJson =
    optionDefs.length > 0 ? JSON.stringify(optionDefs) : null;

  // Get first variant for product-level defaults
  const firstVariant = syncVariants[0];
  const catalogProductId = firstVariant?.product?.product_id;

  // Product-level SKU when single variant
  const productSku =
    syncVariants.length === 1 && syncVariants[0]!.sku
      ? syncVariants[0]!.sku
      : null;

  // Description, brand and model from catalog product; meta description from description
  const description = catalogProduct?.description ?? null;
  const brand = catalogProduct?.brand ?? null;
  const model = catalogProduct?.model ?? null;
  const metaDescription =
    description != null && description.length > 0
      ? description
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : null;

  // Primary image: prefer variant mockup (product-with-design) over sync product thumbnail (often print-file preview)
  const productImageUrl =
    (firstVariant ? getPrintfulVariantImageUrl(firstVariant) : null) ||
    syncProduct.thumbnail_url;

  // Cost per item from first variant's catalog price (wholesale/technique price)
  let costPerItemCents: number | null = null;
  const catalogVariantId = firstVariant?.product?.variant_id;
  if (catalogVariantId != null) {
    try {
      const priceRes = await fetchVariantPrices(catalogVariantId);
      const firstTechnique = priceRes?.data?.variant?.techniques?.[0];
      const priceStr =
        firstTechnique?.discounted_price ?? firstTechnique?.price;
      if (priceStr != null) {
        const costDollars = Number.parseFloat(priceStr);
        if (!Number.isNaN(costDollars)) costPerItemCents = Math.round(costDollars * 100);
      }
    } catch {
      // Optional: continue without cost
    }
  }

  // Shipping countries from Printful API when available; else comprehensive fallback so Markets are populated.
  let marketCountryCodes: string[] = [];
  if (catalogProductId != null) {
    const apiCountries = await fetchCatalogProductShippingCountries(
      catalogProductId,
    );
    if (apiCountries && apiCountries.length > 0) {
      marketCountryCodes = apiCountries;
    }
  }
  if (marketCountryCodes.length === 0) {
    marketCountryCodes = [...POD_SHIPPING_COUNTRY_CODES];
  }
  marketCountryCodes = marketCountryCodes.filter((c) => !isShippingExcluded(c));

  // Create product (vendor, page title, description, brand, sku from catalog/sync)
  // Printful fulfillment typically 2–5 business days; default transit 3–7 for estimates
  await db.insert(productsTable).values({
    id: productId,
    name: syncProduct.name,
    description,
    slug,
    source: "printful",
    externalId: catalogProductId ? String(catalogProductId) : null,
    printfulSyncProductId: syncProduct.id,
    priceCents,
    costPerItemCents,
    hasVariants,
    optionDefinitionsJson,
    published: !syncProduct.is_ignored, // is_ignored = hidden in store
    imageUrl: productImageUrl,
    pageTitle: syncProduct.name,
    metaDescription,
    vendor: "Printful",
    brand,
    sku: productSku,
    countryOfOrigin: catalogProduct?.countryOfOrigin ?? null,
    hsCode: catalogProduct?.hsCode ?? null,
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    physicalProduct: true,
    trackQuantity: false, // Printful manages inventory
    continueSellingWhenOutOfStock: true, // POD products are made to order
    handlingDaysMin: 2,
    handlingDaysMax: 5,
    transitDaysMin: 3,
    transitDaysMax: 7,
  });

  await applyCategoryAutoRules({
    id: productId,
    name: syncProduct.name,
    brand,
    createdAt: now,
  });

  // Create variants (with variant images and size/color)
  for (const syncVariant of syncVariants) {
    await createLocalVariantFromPrintful(productId, syncVariant);
  }

  // Product media: prefer mockups first (variant preview/mockup), then thumbnail (raw product)
  const imageUrlsOrdered: string[] = [];
  const seen = new Set<string>();
  for (const v of syncVariants) {
    const url = getPrintfulVariantImageUrl(v);
    if (url && !seen.has(url)) {
      seen.add(url);
      imageUrlsOrdered.push(url);
    }
  }
  if (syncProduct.thumbnail_url && !seen.has(syncProduct.thumbnail_url)) {
    seen.add(syncProduct.thumbnail_url);
    imageUrlsOrdered.push(syncProduct.thumbnail_url);
  }
  let sortOrder = 0;
  for (const url of imageUrlsOrdered) {
    await db.insert(productImagesTable).values({
      id: nanoid(),
      productId,
      url,
      alt: syncProduct.name,
      sortOrder: sortOrder++,
    });
  }

  // Markets: where Printful ships (from API or fallback; admin "Markets" and shipping use this)
  for (const code of marketCountryCodes) {
    await db.insert(productAvailableCountryTable).values({
      productId,
      countryCode: code,
    });
  }

  // Re-host mockup images to UploadThing in background (SEO, our CDN)
  void import("~/lib/upload-product-mockups")
    .then((m) => m.triggerMockupUploadForProduct(productId))
    .catch((err) =>
      console.warn("Printful post-sync mockup upload failed:", err),
    );

  console.log(`Imported Printful product ${syncProduct.id} as ${productId}`);
  return productId;
}

/**
 * Update an existing local product from Printful sync product data.
 *
 * Updates: name, imageUrl, published, hasVariants, priceCents, pageTitle, vendor, sku.
 * When catalog product is provided, also updates description, brand, metaDescription.
 * Does NOT overwrite: slug, tags (managed locally).
 */
async function updateLocalProductFromPrintful(
  productId: string,
  syncProduct: PrintfulSyncProduct,
  syncVariants: PrintfulSyncVariant[],
  catalogProduct: {
    brand: string | null;
    model: string | null;
    description: string | null;
    countryOfOrigin: string | null;
    hsCode: string | null;
  } | null,
): Promise<void> {
  const now = new Date();
  const hasVariantsFromApi = syncVariants.length > 0;

  // When API returns no variants (e.g. temporary), preserve existing product/variants and only update basic fields
  if (!hasVariantsFromApi) {
    console.warn(
      `Printful product ${syncProduct.id} (local ${productId}): sync_variants empty on re-sync; keeping existing variants and options. Re-sync again later to refresh.`,
    );
  }

  // Determine price from variants (only when we have variants)
  const prices = syncVariants
    .map((v) => Number.parseFloat(v.retail_price || "0") * 100)
    .filter((p) => p > 0);
  const priceCents =
    hasVariantsFromApi && prices.length > 0 ? Math.min(...prices) : undefined;

  // Product-level SKU when single variant
  const productSku =
    hasVariantsFromApi &&
    syncVariants.length === 1 &&
    syncVariants[0]!.sku
      ? syncVariants[0]!.sku
      : null;

  const description = catalogProduct?.description ?? undefined;
  const brand = catalogProduct?.brand ?? undefined;
  const model = catalogProduct?.model ?? undefined;
  const metaDescription =
    description != null && description.length > 0
      ? description
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : undefined;

  const optionDefs = hasVariantsFromApi
    ? buildOptionDefinitionsFromVariants(syncVariants)
    : [];
  const optionDefinitionsJson =
    optionDefs.length > 0 ? JSON.stringify(optionDefs) : null;
  // Prefer mockup over raw thumbnail
  const productImageUrl =
    (syncVariants[0]
      ? getPrintfulVariantImageUrl(syncVariants[0])
      : undefined) ?? syncProduct.thumbnail_url;

  // Cost per item from first variant's catalog price (optional update)
  let costPerItemCents: number | null | undefined = undefined;
  const firstVariant = syncVariants[0];
  const catalogVariantId = firstVariant?.product?.variant_id;
  if (catalogVariantId != null) {
    try {
      const priceRes = await fetchVariantPrices(catalogVariantId);
      const firstTechnique = priceRes?.data?.variant?.techniques?.[0];
      const priceStr =
        firstTechnique?.discounted_price ?? firstTechnique?.price;
      if (priceStr != null) {
        const costDollars = Number.parseFloat(priceStr);
        if (!Number.isNaN(costDollars))
          costPerItemCents = Math.round(costDollars * 100);
      }
    } catch {
      // keep existing cost
    }
  }

  await db
    .update(productsTable)
    .set({
      name: syncProduct.name,
      imageUrl: productImageUrl ?? syncProduct.thumbnail_url,
      published: !syncProduct.is_ignored,
      ...(hasVariantsFromApi && {
        hasVariants: syncVariants.length > 1,
        optionDefinitionsJson,
        ...(productSku != null && { sku: productSku }),
      }),
      pageTitle: syncProduct.name,
      vendor: "Printful",
      ...(description !== undefined && { description }),
      ...(brand !== undefined && { brand }),
      ...(model !== undefined && { model }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(catalogProduct != null && {
        countryOfOrigin: catalogProduct.countryOfOrigin,
        hsCode: catalogProduct.hsCode,
      }),
      ...(priceCents != null && { priceCents }),
      ...(costPerItemCents !== undefined && { costPerItemCents }),
      updatedAt: now,
      lastSyncedAt: now,
    })
    .where(eq(productsTable.id, productId));

  // Sync product images only when we have variants (otherwise keep existing images)
  if (hasVariantsFromApi) {
    await db
      .delete(productImagesTable)
      .where(eq(productImagesTable.productId, productId));
    const imageUrlsOrdered: string[] = [];
    const seen = new Set<string>();
    for (const v of syncVariants) {
      const url = getPrintfulVariantImageUrl(v);
      if (url && !seen.has(url)) {
        seen.add(url);
        imageUrlsOrdered.push(url);
      }
    }
    if (syncProduct.thumbnail_url && !seen.has(syncProduct.thumbnail_url)) {
      seen.add(syncProduct.thumbnail_url);
      imageUrlsOrdered.push(syncProduct.thumbnail_url);
    }
    let sortOrder = 0;
    for (const url of imageUrlsOrdered) {
      await db.insert(productImagesTable).values({
        id: nanoid(),
        productId,
        url,
        alt: syncProduct.name,
        sortOrder: sortOrder++,
      });
    }
  }

  // Sync markets: use Printful API when available; else comprehensive fallback so Markets are populated.
  const catalogProductId = syncVariants[0]?.product?.product_id;
  let marketCountryCodes: string[] = [];
  if (catalogProductId != null) {
    const apiCountries = await fetchCatalogProductShippingCountries(
      catalogProductId,
    );
    if (apiCountries && apiCountries.length > 0) {
      marketCountryCodes = apiCountries;
    }
  }
  if (marketCountryCodes.length === 0) {
    marketCountryCodes = [...POD_SHIPPING_COUNTRY_CODES];
  }
  marketCountryCodes = marketCountryCodes.filter((c) => !isShippingExcluded(c));
  await db
    .delete(productAvailableCountryTable)
    .where(eq(productAvailableCountryTable.productId, productId));
  for (const code of marketCountryCodes) {
    await db.insert(productAvailableCountryTable).values({
      productId,
      countryCode: code,
    });
  }

  // Re-host mockup images to UploadThing in background (SEO, our CDN)
  void import("~/lib/upload-product-mockups")
    .then((m) => m.triggerMockupUploadForProduct(productId))
    .catch((err) =>
      console.warn("Printful post-sync mockup upload failed:", err),
    );

  // Sync variants only when API returned variants (otherwise preserve existing)
  if (hasVariantsFromApi) {
    const existingVariants = await db
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, productId));

    type VariantRow = (typeof existingVariants)[number];
    const existingVariantMap = new Map<number | null, VariantRow[]>();
    for (const v of existingVariants) {
      const raw = v.printfulSyncVariantId;
      const key =
        raw == null
          ? null
          : typeof raw === "number"
            ? raw
            : Number.parseInt(String(raw), 10);
      const keyNorm = key !== null && !Number.isNaN(key) ? key : null;
      const list = existingVariantMap.get(keyNorm) ?? [];
      list.push(v);
      existingVariantMap.set(keyNorm, list);
    }
    const incomingVariantIds = new Set(syncVariants.map((v) => v.id));
    const matchedLocalIds = new Set<string>();

    for (const syncVariant of syncVariants) {
      const bySyncId = existingVariantMap.get(syncVariant.id);
      const existing = bySyncId?.[0];
      if (existing) {
        matchedLocalIds.add(existing.id);
        await updateLocalVariantFromPrintful(existing.id, syncVariant);
        continue;
      }
      // Backfill: match by size/color/label when variants have no printfulSyncVariantId (e.g. after first sync or legacy data)
      const syncSize = getVariantSize(syncVariant)?.trim() ?? "";
      const syncColor = getVariantColor(syncVariant)?.trim() ?? "";
      const syncLabel = (syncVariant.name ?? "").trim();
      const unmatched = existingVariants.filter(
        (v) =>
          !matchedLocalIds.has(v.id) &&
          (v.size?.trim() ?? "") === syncSize &&
          (v.color?.trim() ?? "") === syncColor &&
          (v.label?.trim() ?? "") === syncLabel,
      );
      const toUpdate = unmatched[0];
      if (toUpdate) {
        matchedLocalIds.add(toUpdate.id);
        await updateLocalVariantFromPrintful(toUpdate.id, syncVariant);
      } else {
        await createLocalVariantFromPrintful(productId, syncVariant);
      }
    }

    for (const v of existingVariants) {
      const syncId =
        typeof v.printfulSyncVariantId === "number"
          ? v.printfulSyncVariantId
          : Number.parseInt(String(v.printfulSyncVariantId ?? ""), 10);
      if (
        !Number.isNaN(syncId) &&
        syncId > 0 &&
        !incomingVariantIds.has(syncId)
      ) {
        await db
          .delete(productVariantsTable)
          .where(eq(productVariantsTable.id, v.id));
        console.log(`Deleted variant ${v.id} (no longer in Printful)`);
      }
    }
  }

  console.log(
    `Updated Printful product ${syncProduct.id} (local: ${productId})`,
  );
}

/**
 * Create a local variant from Printful sync variant data.
 */
async function createLocalVariantFromPrintful(
  productId: string,
  syncVariant: PrintfulSyncVariant,
): Promise<string> {
  const variantId = nanoid();
  const now = new Date();

  const priceCents = Math.round(
    Number.parseFloat(syncVariant.retail_price || "0") * 100,
  );

  const imageUrl = getPrintfulVariantImageUrl(syncVariant);

  const size = getVariantSize(syncVariant);
  const color = getVariantColor(syncVariant);
  const values = {
    id: variantId,
    productId,
    externalId: String(syncVariant.variant_id), // Printful catalog variant ID for ordering
    printfulSyncVariantId: syncVariant.id,
    size,
    color,
    sku: syncVariant.sku,
    label: syncVariant.name ?? null,
    priceCents,
    imageUrl,
    availabilityStatus: syncVariant.availability_status ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const rows = await db
    .insert(productVariantsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        productVariantsTable.productId,
        productVariantsTable.printfulSyncVariantId,
      ],
      set: {
        externalId: values.externalId,
        size: values.size,
        color: values.color,
        sku: values.sku,
        label: values.label,
        priceCents: values.priceCents,
        imageUrl: values.imageUrl,
        availabilityStatus: values.availabilityStatus,
        updatedAt: now,
      },
    })
    .returning({ id: productVariantsTable.id });

  return rows[0]?.id ?? variantId;
}

/**
 * Update a local variant from Printful sync variant data.
 * Keeps or sets variant image (preview/mockup or catalog image).
 */
async function updateLocalVariantFromPrintful(
  variantId: string,
  syncVariant: PrintfulSyncVariant,
): Promise<void> {
  const now = new Date();
  const priceCents = Math.round(
    Number.parseFloat(syncVariant.retail_price || "0") * 100,
  );

  const imageUrl = getPrintfulVariantImageUrl(syncVariant);

  const size = getVariantSize(syncVariant);
  const color = getVariantColor(syncVariant);
  await db
    .update(productVariantsTable)
    .set({
      externalId: String(syncVariant.variant_id),
      printfulSyncVariantId: syncVariant.id,
      size,
      color,
      sku: syncVariant.sku,
      label: syncVariant.name ?? undefined,
      priceCents,
      imageUrl: imageUrl ?? undefined,
      availabilityStatus: syncVariant.availability_status ?? undefined,
      updatedAt: now,
    })
    .where(eq(productVariantsTable.id, variantId));
}

// ============================================================================
// Export: Backend → Printful
// ============================================================================

/**
 * Push local product changes to Printful.
 *
 * Updates:
 * - Product name (sync_product.name)
 * - Product thumbnail (sync_product.thumbnail) - if imageUrl is set
 * - Variant retail_price
 * - Variant SKU
 *
 * Note: Printful Sync Products API (V1) does NOT support description or tags.
 * These fields are not part of the sync product model. If you need description/tags,
 * they must be managed directly in Printful's dashboard.
 */
export async function exportProductToPrintful(
  productId: string,
): Promise<ProductExportResult> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { success: false, error: "Printful not configured" };
  }

  // Get product
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  if (product.source !== "printful" || !product.printfulSyncProductId) {
    return { success: false, error: "Product is not a Printful sync product" };
  }

  // Get variants
  const variants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));

  const storeId = (() => {
    const raw = process.env.PRINTFUL_STORE_ID?.trim();
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  })();

  try {
    // Update product-level fields (name, thumbnail)
    // Note: Printful V1 Sync Products API only supports: name, thumbnail, external_id, is_ignored
    await updateSyncProduct(
      product.printfulSyncProductId,
      {
        sync_product: {
          name: product.name,
          ...(product.imageUrl && { thumbnail: product.imageUrl }),
        },
        // When updating sync_variants, we must include all variant IDs to keep them
        // Only specify IDs of existing variants to prevent deletion
        sync_variants: variants
          .filter((v) => v.printfulSyncVariantId)
          .map((v) => ({
            id: v.printfulSyncVariantId!,
            retail_price: (v.priceCents / 100).toFixed(2),
            sku: v.sku || undefined,
          })),
      },
      storeId,
    );

    // Update product last synced timestamp
    await db
      .update(productsTable)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(productsTable.id, productId));

    return {
      success: true,
      printfulSyncProductId: product.printfulSyncProductId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Push price changes for all Printful products to Printful.
 */
export async function exportAllPrintfulProducts(): Promise<SyncResult> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Printful not configured"],
    };
  }

  const result: SyncResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all Printful products
  const products = await db
    .select({
      id: productsTable.id,
      printfulSyncProductId: productsTable.printfulSyncProductId,
    })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.source, "printful"),
        // Only products with sync product ID
      ),
    );

  for (const product of products) {
    if (!product.printfulSyncProductId) {
      result.skipped++;
      continue;
    }

    const exportResult = await exportProductToPrintful(product.id);
    if (exportResult.success) {
      result.updated++;
    } else {
      result.errors.push(`Product ${product.id}: ${exportResult.error}`);
    }
  }

  return result;
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle Printful product_synced webhook event.
 * Called when a product is synced (created) in Printful.
 */
export async function handleProductSynced(data: {
  sync_product: PrintfulSyncProduct;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await importSinglePrintfulProduct(data.sync_product.id, false);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product_synced:", message);
    return { success: false, error: message };
  }
}

/**
 * Handle Printful product_updated webhook event.
 * Called when a product is updated in Printful.
 */
export async function handleProductUpdated(data: {
  sync_product: PrintfulSyncProduct;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Import with overwrite to update existing
    await importSinglePrintfulProduct(data.sync_product.id, true);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product_updated:", message);
    return { success: false, error: message };
  }
}

/**
 * Handle Printful product_deleted webhook event.
 * Called when a product is deleted in Printful.
 */
export async function handleProductDeleted(data: {
  sync_product: { id: number };
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Find and unpublish (or delete) the local product
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.printfulSyncProductId, data.sync_product.id))
      .limit(1);

    if (!product) {
      // Product doesn't exist locally - nothing to do
      return { success: true };
    }

    // Option 1: Unpublish the product (safer - keeps historical data)
    await db
      .update(productsTable)
      .set({
        published: false,
        updatedAt: new Date(),
        printfulSyncProductId: null, // Unlink from Printful
      })
      .where(eq(productsTable.id, product.id));

    console.log(
      `Unpublished product ${product.id} (Printful sync product deleted)`,
    );

    // Option 2: Delete the product (uncomment to use)
    // await db.delete(productsTable).where(eq(productsTable.id, product.id));
    // console.log(`Deleted product ${product.id} (Printful sync product deleted)`);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product_deleted:", message);
    return { success: false, error: message };
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert a string to a URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * Get sync status for a product.
 */
export async function getProductSyncStatus(productId: string): Promise<{
  synced: boolean;
  printfulSyncProductId: number | null;
  lastSyncedAt: Date | null;
  error?: string;
}> {
  const [product] = await db
    .select({
      printfulSyncProductId: productsTable.printfulSyncProductId,
      lastSyncedAt: productsTable.lastSyncedAt,
      source: productsTable.source,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return {
      synced: false,
      printfulSyncProductId: null,
      lastSyncedAt: null,
      error: "Product not found",
    };
  }

  return {
    synced:
      product.source === "printful" && product.printfulSyncProductId != null,
    printfulSyncProductId: product.printfulSyncProductId,
    lastSyncedAt: product.lastSyncedAt,
  };
}

/**
 * List all Printful sync products from the API (not local DB).
 * Useful for admin UI to show what's available to import.
 */
export async function listAvailablePrintfulProducts(): Promise<{
  products: PrintfulSyncProduct[];
  error?: string;
}> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { products: [], error: "Printful not configured" };
  }

  try {
    const allProducts: PrintfulSyncProduct[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { products, paging } = await fetchSyncProducts({
        offset,
        limit,
        status: "synced",
      });
      allProducts.push(...products);
      offset += products.length;
      hasMore = offset < paging.total;
    }

    return { products: allProducts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { products: [], error: message };
  }
}

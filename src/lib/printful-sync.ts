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

import { and, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";

import { conn, db } from "~/db";
import {
  productAvailableCountryTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  sizeChartsTable,
} from "~/db/schema";
import { applyCategoryAutoRules } from "~/lib/category-auto-assign";
import { POD_SHIPPING_COUNTRY_CODES } from "~/lib/pod-shipping-countries";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { slugify } from "~/lib/slugify";

import {
  fetchCatalogProduct,
  fetchCatalogProductShippingCountries,
  fetchCatalogProductShippingCustoms,
  fetchCatalogVariants,
  fetchProductSizeGuideSafe,
  fetchSyncProduct,
  fetchSyncProducts,
  fetchVariantPrices,
  getPrintfulIfConfigured,
  type PrintfulCatalogVariant,
  type PrintfulSyncProduct,
  type PrintfulSyncVariant,
  updateSyncProduct,
} from "./printful";

/**
 * Ensure product_variant has Printful/Printify columns with correct types.
 * BIGINT is required because Printful sync variant IDs exceed 32-bit INTEGER max (2,147,483,647).
 * Runs once per process; safe to call repeatedly.
 */
let ensureColumnsPromise: null | Promise<void> = null;
export interface ProductExportResult {
  error?: string;
  printfulSyncProductId?: number;
  success: boolean;
}

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  errors: string[];
  imported: number;
  skipped: number;
  success: boolean;
  updated: number;
}

/**
 * Fix miscapitalized display names on existing size charts.
 * The old title-casing bug produced names like "HOodies", "POlos", "CAnvas".
 * This applies correct title casing to every stored display name and updates
 * any that changed. Safe to call multiple times (idempotent).
 */
export async function fixSizeChartDisplayNames(): Promise<{
  fixed: number;
  total: number;
}> {
  const allCharts = await db
    .select({
      displayName: sizeChartsTable.displayName,
      id: sizeChartsTable.id,
    })
    .from(sizeChartsTable);

  let fixed = 0;
  for (const chart of allCharts) {
    // Re-apply correct title casing: lowercase the whole thing, then uppercase first letter of each word
    const corrected = chart.displayName
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (corrected !== chart.displayName) {
      await db
        .update(sizeChartsTable)
        .set({ displayName: corrected, updatedAt: new Date() })
        .where(eq(sizeChartsTable.id, chart.id));
      fixed++;
    }
  }

  return { fixed, total: allCharts.length };
}

// ============================================================================
// Import: Printful → Backend
// ============================================================================

/**
 * Import all sync products from Printful to local database.
 * Creates new products or updates existing ones based on printfulSyncProductId.
 */
export async function importAllPrintfulProducts(
  options: {
    /** Overwrite existing product data (name, description, etc.) */
    overwriteExisting?: boolean;
    /** Only import products in "synced" status */
    syncedOnly?: boolean;
  } = {},
): Promise<SyncResult> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return {
      errors: ["Printful not configured"],
      imported: 0,
      skipped: 0,
      success: false,
      updated: 0,
    };
  }

  const result: SyncResult = {
    errors: [],
    imported: 0,
    skipped: 0,
    success: true,
    updated: 0,
  };

  try {
    // Fetch all sync products (paginated)
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { paging, products } = await fetchSyncProducts({
        limit,
        offset,
        status: options.syncedOnly ? "synced" : "all",
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
 * Import size chart for a single Printful product by our product id.
 * Uses the product's stored externalId (catalog product id), brand, and model.
 * Call this after a single-product resync to ensure the size chart is pulled even if the in-flow import was skipped or failed.
 */
export async function importSizeChartForPrintfulProduct(
  productId: string,
): Promise<{ error?: string; success: boolean }> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { error: "Printful not configured", success: false };
  }

  const [row] = await db
    .select({
      brand: productsTable.brand,
      externalId: productsTable.externalId,
      model: productsTable.model,
      source: productsTable.source,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!row || row.source !== "printful" || row.externalId == null) {
    return {
      error: "Product not found or is not a Printful product with catalog id",
      success: false,
    };
  }

  const catalogProductId = Number.parseInt(String(row.externalId), 10);
  if (!Number.isFinite(catalogProductId) || catalogProductId <= 0) {
    return { error: "Invalid catalog product id", success: false };
  }

  const brand = (row.brand?.trim() || "Printful").trim() || "Printful";
  const model =
    (row.model?.trim() || String(catalogProductId)).trim() ||
    String(catalogProductId);

  try {
    const upserted = await upsertPrintfulSizeChart(
      catalogProductId,
      brand,
      model,
    );
    return upserted
      ? { success: true }
      : {
          error: "Printful returned no size guide for this catalog product",
          success: false,
        };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, success: false };
  }
}

/**
 * Backfill size charts for all existing Printful products.
 * Fetches size guides from Printful for each distinct catalog product (brand+model) and upserts into size_chart.
 * Call this after a resync if size charts were not imported (e.g. products were skipped).
 */
export async function importSizeChartsForAllPrintfulProducts(): Promise<{
  errors: string[];
  success: boolean;
  upserted: number;
}> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { errors: ["Printful not configured"], success: false, upserted: 0 };
  }

  const errors: string[] = [];
  let upserted = 0;

  try {
    const rows = await db
      .select({
        brand: productsTable.brand,
        externalId: productsTable.externalId,
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
        errors.push(
          `Catalog ${catalogProductId} (${brand} / ${model}): ${message}`,
        );
      }
    }

    return {
      errors,
      success: errors.length === 0,
      upserted,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { errors: [message], success: false, upserted };
  }
}

async function ensurePrintfulColumns(): Promise<void> {
  if (ensureColumnsPromise != null) return ensureColumnsPromise;
  ensureColumnsPromise = (async () => {
    const stmts = [
      `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS printful_sync_variant_id BIGINT`,
      `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS printify_variant_id TEXT`,
      `ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS external_id TEXT`,
      `ALTER TABLE product_variant ALTER COLUMN printful_sync_variant_id TYPE BIGINT`,
    ];
    for (const sql of stmts) {
      try {
        await conn.unsafe(sql);
      } catch (e) {
        console.warn(
          "[Printful sync] Column setup failed. Run: psql $DATABASE_URL -f scripts/migrate-printful-printify-sync.sql",
          (e as Error).message,
        );
      }
    }
    // Best-effort: upgrade product table too
    try {
      await conn.unsafe(
        `ALTER TABLE product ALTER COLUMN printful_sync_product_id TYPE BIGINT`,
      );
    } catch {
      /* non-blocking */
    }
  })();
  return ensureColumnsPromise;
}

/**
 * Import a single Printful sync product by ID.
 * When admin runs sync, we retry if Printful returns no variants (they often need a few seconds after publish).
 */
const PRINTFUL_VARIANT_RETRY_DELAYS_MS = [2000, 5000, 10000];

/**
 * Push price changes for all Printful products to Printful.
 */
export async function exportAllPrintfulProducts(): Promise<SyncResult> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return {
      errors: ["Printful not configured"],
      imported: 0,
      skipped: 0,
      success: false,
      updated: 0,
    };
  }

  const result: SyncResult = {
    errors: [],
    imported: 0,
    skipped: 0,
    success: true,
    updated: 0,
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
    return { error: "Printful not configured", success: false };
  }

  // Get product
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return { error: "Product not found", success: false };
  }

  if (product.source !== "printful" || !product.printfulSyncProductId) {
    return { error: "Product is not a Printful sync product", success: false };
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
      printfulSyncProductId: product.printfulSyncProductId,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, success: false };
  }
}

/**
 * Get sync status for a product.
 */
export async function getProductSyncStatus(productId: string): Promise<{
  error?: string;
  lastSyncedAt: Date | null;
  printfulSyncProductId: null | number;
  synced: boolean;
}> {
  const [product] = await db
    .select({
      lastSyncedAt: productsTable.lastSyncedAt,
      printfulSyncProductId: productsTable.printfulSyncProductId,
      source: productsTable.source,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return {
      error: "Product not found",
      lastSyncedAt: null,
      printfulSyncProductId: null,
      synced: false,
    };
  }

  return {
    lastSyncedAt: product.lastSyncedAt,
    printfulSyncProductId: product.printfulSyncProductId,
    synced:
      product.source === "printful" && product.printfulSyncProductId != null,
  };
}

/**
 * Handle Printful product_deleted webhook event.
 * Called when a product is deleted in Printful.
 */
export async function handleProductDeleted(data: {
  sync_product: { id: number };
}): Promise<{ error?: string; success: boolean }> {
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
        printfulSyncProductId: null, // Unlink from Printful
        published: false,
        updatedAt: new Date(),
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
    return { error: message, success: false };
  }
}

/**
 * Handle Printful product_synced webhook event.
 * Called when a product is synced (created) in Printful.
 */
export async function handleProductSynced(data: {
  sync_product: PrintfulSyncProduct;
}): Promise<{ error?: string; success: boolean }> {
  try {
    await importSinglePrintfulProduct(data.sync_product.id, false);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product_synced:", message);
    return { error: message, success: false };
  }
}

/**
 * Handle Printful product_updated webhook event.
 * Called when a product is updated in Printful.
 */
export async function handleProductUpdated(data: {
  sync_product: PrintfulSyncProduct;
}): Promise<{ error?: string; success: boolean }> {
  try {
    // Import with overwrite to update existing
    await importSinglePrintfulProduct(data.sync_product.id, true);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product_updated:", message);
    return { error: message, success: false };
  }
}

export async function importSinglePrintfulProduct(
  printfulSyncProductId: number,
  overwriteExisting = false,
): Promise<{ action: "imported" | "skipped" | "updated"; productId: string }> {
  await ensurePrintfulColumns();
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

  // Fetch catalog product for description/brand/model/type and shipping/customs. Brand/model required for size chart + product page.
  let catalogProduct: null | {
    brand: string;
    countryOfOrigin: null | string;
    description: null | string;
    hsCode: null | string;
    isDiscontinued: boolean;
    model: string;
    productType: null | string;
  } = null;
  /** Map of catalog_variant_id → catalog variant details (for colorCode, weight). */
  const catalogVariantMap = new Map<number, PrintfulCatalogVariant>();
  const catalogProductId = syncVariants[0]?.product?.product_id;
  if (catalogProductId != null) {
    try {
      const [catalog, customs, catalogVariantsRes] = await Promise.all([
        fetchCatalogProduct(catalogProductId),
        fetchCatalogProductShippingCustoms(catalogProductId),
        fetchCatalogVariants(catalogProductId).catch(() => null),
      ]);
      if (catalog?.data) {
        // Fallback so we always have brand/model for size_chart and product (Printful may omit for some catalog items)
        const brand = (catalog.data.brand ?? "Printful").trim() || "Printful";
        const model =
          (catalog.data.model ?? String(catalogProductId)).trim() ||
          String(catalogProductId);
        catalogProduct = {
          brand,
          countryOfOrigin: customs.countryOfOrigin,
          description: catalog.data.description ?? null,
          hsCode: customs.hsCode,
          isDiscontinued: catalog.data.is_discontinued ?? false,
          model,
          productType: catalog.data.type ?? null,
        };
      } else {
        catalogProduct = {
          brand: "Printful",
          countryOfOrigin: null,
          description: null,
          hsCode: null,
          isDiscontinued: false,
          model: String(catalogProductId),
          productType: null,
        };
      }
      // Build variant lookup for colorCode/colorCode2
      if (catalogVariantsRes?.data) {
        for (const cv of catalogVariantsRes.data) {
          catalogVariantMap.set(cv.id, cv);
        }
      }
    } catch (err) {
      console.warn(
        "Printful catalog fetch failed for product",
        catalogProductId,
        err,
      );
      catalogProduct = {
        brand: "Printful",
        countryOfOrigin: null,
        description: null,
        hsCode: null,
        isDiscontinued: false,
        model: String(catalogProductId),
        productType: null,
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
      catalogVariantMap,
    );
    if (catalogProductId != null && catalogProduct) {
      await upsertPrintfulSizeChart(
        catalogProductId,
        catalogProduct.brand,
        catalogProduct.model,
      );
    }
    return { action: "updated", productId: existingProduct.id };
  }

  // Create new product
  const productId = await createLocalProductFromPrintful(
    syncProduct,
    syncVariants,
    catalogProduct,
    catalogVariantMap,
  );
  if (catalogProductId != null && catalogProduct) {
    await upsertPrintfulSizeChart(
      catalogProductId,
      catalogProduct.brand,
      catalogProduct.model,
    );
  }
  return { action: "imported", productId };
}

/**
 * List all Printful sync products from the API (not local DB).
 * Useful for admin UI to show what's available to import.
 */
export async function listAvailablePrintfulProducts(): Promise<{
  error?: string;
  products: PrintfulSyncProduct[];
}> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { error: "Printful not configured", products: [] };
  }

  try {
    const allProducts: PrintfulSyncProduct[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { paging, products } = await fetchSyncProducts({
        limit,
        offset,
        status: "synced",
      });
      allProducts.push(...products);
      offset += products.length;
      hasMore = offset < paging.total;
    }

    return { products: allProducts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, products: [] };
  }
}

/** Build option definitions (Size, Color) from sync variants for storefront and admin. Fallback to variant names when size/color not extracted. */
function buildOptionDefinitionsFromVariants(
  syncVariants: PrintfulSyncVariant[],
): { name: string; values: string[] }[] {
  const sizeValues = new Set<string>();
  const colorValues = new Set<string>();
  for (const v of syncVariants) {
    const size = getVariantSize(v);
    const color = getVariantColor(v);
    if (size) sizeValues.add(size);
    if (color) colorValues.add(color);
  }
  const options: { name: string; values: string[] }[] = [];
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

async function createLocalProductFromPrintful(
  syncProduct: PrintfulSyncProduct,
  syncVariants: PrintfulSyncVariant[],
  catalogProduct: null | {
    brand: null | string;
    countryOfOrigin: null | string;
    description: null | string;
    hsCode: null | string;
    isDiscontinued: boolean;
    model: null | string;
    productType: null | string;
  },
  catalogVariantMap?: Map<number, PrintfulCatalogVariant>,
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
  let costPerItemCents: null | number = null;
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
      // Optional: continue without cost
    }
  }

  // Shipping countries from Printful API when available; else comprehensive fallback so Markets are populated.
  let marketCountryCodes: string[] = [];
  if (catalogProductId != null) {
    const apiCountries =
      await fetchCatalogProductShippingCountries(catalogProductId);
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
    brand,
    continueSellingWhenOutOfStock: true, // POD products are made to order
    costPerItemCents,
    countryOfOrigin: catalogProduct?.countryOfOrigin ?? null,
    createdAt: now,
    description,
    externalId: catalogProductId ? String(catalogProductId) : null,
    handlingDaysMax: 5,
    handlingDaysMin: 2,
    hasVariants,
    hsCode: catalogProduct?.hsCode ?? null,
    id: productId,
    imageUrl: productImageUrl,
    isDiscontinued: catalogProduct?.isDiscontinued ?? false,
    lastSyncedAt: now,
    metaDescription,
    model,
    name: syncProduct.name,
    optionDefinitionsJson,
    pageTitle: syncProduct.name,
    physicalProduct: true,
    priceCents,
    printfulSyncProductId: syncProduct.id,
    productType: catalogProduct?.productType ?? null,
    published: !syncProduct.is_ignored, // is_ignored = hidden in store
    sku: productSku,
    slug,
    source: "printful",
    trackQuantity: false, // Printful manages inventory
    transitDaysMax: 7,
    transitDaysMin: 3,
    updatedAt: now,
    vendor: "Printful",
  });

  await applyCategoryAutoRules({
    brand,
    createdAt: now,
    id: productId,
    name: syncProduct.name,
  });

  // Markets first so they are always set even if variant creation fails later
  for (const code of marketCountryCodes) {
    await db.insert(productAvailableCountryTable).values({
      countryCode: code,
      productId,
    });
  }

  // Create variants (with variant images and size/color)
  for (const syncVariant of syncVariants) {
    await createLocalVariantFromPrintful(
      productId,
      syncVariant,
      catalogVariantMap,
    );
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
      alt: syncProduct.name,
      id: nanoid(),
      productId,
      sortOrder: sortOrder++,
      url,
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
 * Create or update a local variant from Printful sync variant data.
 * Stores two Printful IDs: printfulSyncVariantId (sync variant id) and externalId (catalog_variant_id for shipping).
 * Uses upsert pattern: find existing by printfulSyncVariantId → update, else insert.
 */
async function createLocalVariantFromPrintful(
  productId: string,
  syncVariant: PrintfulSyncVariant,
  catalogVariantMap?: Map<number, PrintfulCatalogVariant>,
): Promise<string> {
  const now = new Date();
  const priceCents = Math.round(
    Number.parseFloat(String(syncVariant.retail_price || "0")) * 100,
  );
  const safePriceCents = Number.isFinite(priceCents) ? priceCents : 0;
  const imageUrl = getPrintfulVariantImageUrl(syncVariant);
  const size = getVariantSize(syncVariant);
  const color = getVariantColor(syncVariant);
  const labelRaw = (syncVariant.name ?? "").trim();
  const label =
    labelRaw || [size, color].filter(Boolean).join(" / ") || "Variant";
  const externalId = String(syncVariant.variant_id);
  const printfulSyncVariantId = syncVariant.id;

  // Get catalog variant details for colorCode, colorCode2
  const catalogVariant = catalogVariantMap?.get(syncVariant.variant_id);

  const variantFields = {
    availabilityStatus: syncVariant.availability_status ?? null,
    color: color ?? null,
    colorCode: catalogVariant?.color_code ?? null,
    colorCode2: catalogVariant?.color_code2 ?? null,
    externalId,
    imageUrl: imageUrl ?? null,
    label,
    priceCents: safePriceCents,
    printfulSyncVariantId,
    size: size ?? null,
    sku: syncVariant.sku ?? null,
    updatedAt: now,
  };

  // 1) Find existing variant by (productId, printfulSyncVariantId) → update
  const [existing] = await db
    .select({ id: productVariantsTable.id })
    .from(productVariantsTable)
    .where(
      and(
        eq(productVariantsTable.productId, productId),
        eq(productVariantsTable.printfulSyncVariantId, printfulSyncVariantId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(productVariantsTable)
      .set(variantFields)
      .where(eq(productVariantsTable.id, existing.id));
    return existing.id;
  }

  // 2) No existing row → insert
  const variantId = nanoid();
  try {
    await db.insert(productVariantsTable).values({
      id: variantId,
      productId,
      ...variantFields,
      createdAt: now,
    });
    return variantId;
  } catch (err) {
    // Race condition: another process inserted between our SELECT and INSERT
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate") || msg.includes("unique constraint")) {
      const [found] = await db
        .select({ id: productVariantsTable.id })
        .from(productVariantsTable)
        .where(
          and(
            eq(productVariantsTable.productId, productId),
            eq(
              productVariantsTable.printfulSyncVariantId,
              printfulSyncVariantId,
            ),
          ),
        )
        .limit(1);
      if (found) {
        await db
          .update(productVariantsTable)
          .set(variantFields)
          .where(eq(productVariantsTable.id, found.id));
        return found.id;
      }
    }
    throw err;
  }
}

/**
 * Delete product variants that are not referenced in any order.
 * Used when find/update repeatedly fails so we can replace with fresh rows from Printful.
 * Returns number of variants deleted.
 */
async function deleteUnreferencedPrintfulVariants(
  productId: string,
): Promise<number> {
  const rows = await conn`
    DELETE FROM product_variant
    WHERE product_id = ${productId}
      AND id NOT IN (SELECT product_variant_id FROM order_item WHERE product_variant_id IS NOT NULL)
    RETURNING id
  `;
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Get variant image URL: prefer product mockup (product-with-design) over print file (design-only).
 * Order: mockup > preview > default. Avoid using the "default" file when it's the print/design file.
 */
function getPrintfulVariantImageUrl(
  syncVariant: PrintfulSyncVariant,
): null | string {
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

/** Get color from sync variant: top-level or options array (Printful may use options only). */
function getVariantColor(v: PrintfulSyncVariant): null | string {
  if (v.color?.trim()) return v.color.trim();
  const opts = v.options ?? [];
  const idLower = (id: string | undefined) => (id ?? "").toLowerCase();
  const colorOpt = opts.find((o) => idLower(o?.id).includes("color"));
  return optionValueToString(colorOpt ?? null);
}

// ============================================================================
// Export: Backend → Printful
// ============================================================================

/** Get size from sync variant: top-level or options array (Printful may use options only). */
function getVariantSize(v: PrintfulSyncVariant): null | string {
  if (v.size?.trim()) return v.size.trim();
  const opts = v.options ?? [];
  const idLower = (id: string | undefined) => (id ?? "").toLowerCase();
  const sizeOpt = opts.find((o) => idLower(o?.id).includes("size"));
  return optionValueToString(sizeOpt ?? null);
}

/**
 * Normalize Printful size guide API response to our stored JSON shape.
 * Supports: res.data (v2), res.result (v1), or direct payload (size_tables at top level).
 */
function normalizeSizeGuideData(
  res: null | {
    available_sizes?: string[];
    data?: {
      available_sizes?: string[];
      size_tables?: {
        description?: string;
        image_url?: string;
        measurements?: unknown;
        type: string;
        unit: string;
      }[];
    };
    result?: {
      available_sizes?: string[];
      size_tables?: {
        description?: string;
        image_url?: string;
        measurements?: unknown;
        type: string;
        unit: string;
      }[];
    };
    size_tables?: {
      description?: string;
      image_url?: string;
      measurements?: unknown;
      type: string;
      unit: string;
    }[];
  },
): null | {
  availableSizes: string[];
  sizeTables: {
    description?: string;
    image_url?: string;
    measurements?: unknown;
    type: string;
    unit: string;
  }[];
} {
  interface Payload {
    available_sizes?: string[];
    size_tables?: {
      description?: string;
      image_url?: string;
      measurements?: unknown;
      type: string;
      unit: string;
    }[];
  }
  const raw =
    res == null
      ? null
      : ((res as { data?: Payload; result?: Payload }).data ??
        (res as { result?: Payload }).result ??
        (res as Payload));
  const payload: null | Payload = raw;
  if (!payload?.size_tables?.length) return null;
  return {
    availableSizes: payload.available_sizes ?? [],
    sizeTables: payload.size_tables.map((t) => ({
      description: t.description,
      image_url: t.image_url,
      measurements: t.measurements,
      type: t.type,
      unit: t.unit,
    })),
  };
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/** Coerce option value to string (Printful can return string | boolean). */
function optionValueToString(
  opt: null | { id?: string; value?: boolean | string },
): null | string {
  if (opt == null) return null;
  const v = opt.value;
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/**
 * Derive size chart display name from Printful catalog product type/name.
 * Prefers product-type keywords (Hoodie, Sweatshirt, etc.) so hoodies don't show as "T-Shirts".
 * Examples: "Hoodie" → "Hoodies", "Unisex Hoodie" → "Hoodies", "T-Shirt" → "T-Shirts".
 */
function sizeChartDisplayNameFromCatalog(
  type: null | string | undefined,
  name: null | string | undefined,
): string {
  const typeRaw = (type ?? "").trim();
  const nameRaw = (name ?? "").trim();
  const combined = [typeRaw, nameRaw].filter(Boolean).join(" ");
  if (!combined) return "T-Shirts";

  // Prefer product-type keywords so "Unisex Hoodie" / "HOODIE" → "Hoodies", not "Unisex Hoodies"
  const lower = combined.toLowerCase();
  const productTypeKeywords = [
    "hoodie",
    "sweatshirt",
    "sweat shirt",
    "long sleeve",
    "t-shirt",
    "t shirt",
    "tank",
    "polo",
    "shirt",
    "jacket",
    "zip",
    "fleece",
    "joggers",
    "leggings",
    "shorts",
    "pants",
    "dress",
    "skirt",
    "hat",
    "cap",
    "bag",
    "tote",
    "poster",
    "canvas",
    "shoes",
    "sneakers",
    "sandals",
  ];
  for (const keyword of productTypeKeywords) {
    if (lower.includes(keyword)) {
      const word = keyword.replace(/\s+/g, " ");
      const titleCased = word.replace(/\b\w/g, (c) => c.toUpperCase());
      return titleCased.endsWith("s") ? titleCased : `${titleCased}s`;
    }
  }

  // Fallback: title-case the first word of type or name
  const first = (typeRaw || nameRaw).split(/[\s-]+/)[0] ?? "";
  const titleCased = first
    ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
    : "";
  if (!titleCased) return "T-Shirts";
  return titleCased.endsWith("s") ? titleCased : `${titleCased}s`;
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
  catalogProduct: null | {
    brand: null | string;
    countryOfOrigin: null | string;
    description: null | string;
    hsCode: null | string;
    isDiscontinued: boolean;
    model: null | string;
    productType: null | string;
  },
  catalogVariantMap?: Map<number, PrintfulCatalogVariant>,
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
    hasVariantsFromApi && syncVariants.length === 1 && syncVariants[0]!.sku
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
  let costPerItemCents: null | number | undefined;
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
      imageUrl: productImageUrl ?? syncProduct.thumbnail_url,
      name: syncProduct.name,
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
        isDiscontinued: catalogProduct.isDiscontinued,
        productType: catalogProduct.productType,
      }),
      ...(priceCents != null && { priceCents }),
      ...(costPerItemCents !== undefined && { costPerItemCents }),
      lastSyncedAt: now,
      updatedAt: now,
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
        alt: syncProduct.name,
        id: nanoid(),
        productId,
        sortOrder: sortOrder++,
        url,
      });
    }
  }

  // Sync markets: use Printful API when available; else comprehensive fallback so Markets are populated.
  const catalogProductId = syncVariants[0]?.product?.product_id;
  let marketCountryCodes: string[] = [];
  if (catalogProductId != null) {
    const apiCountries =
      await fetchCatalogProductShippingCountries(catalogProductId);
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
      countryCode: code,
      productId,
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
    const incomingVariantIds = new Set(syncVariants.map((v) => v.id));

    const runVariantSync = async (
      existingVariants: (typeof productVariantsTable.$inferSelect)[],
    ) => {
      type VariantRow = (typeof existingVariants)[number];
      const existingVariantMap = new Map<null | number, VariantRow[]>();
      for (const v of existingVariants) {
        const key = v.printfulSyncVariantId ?? null;
        const list = existingVariantMap.get(key) ?? [];
        list.push(v);
        existingVariantMap.set(key, list);
      }
      const matchedLocalIds = new Set<string>();

      for (const syncVariant of syncVariants) {
        const bySyncId = existingVariantMap.get(syncVariant.id);
        const existing = bySyncId?.[0];
        if (existing) {
          matchedLocalIds.add(existing.id);
          await updateLocalVariantFromPrintful(
            existing.id,
            syncVariant,
            catalogVariantMap,
          );
          continue;
        }
        // Backfill: match by size/color/label when variants have no printfulSyncVariantId
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
          await updateLocalVariantFromPrintful(
            toUpdate.id,
            syncVariant,
            catalogVariantMap,
          );
        } else {
          await createLocalVariantFromPrintful(
            productId,
            syncVariant,
            catalogVariantMap,
          );
        }
      }

      // Remove variants no longer in Printful
      for (const v of existingVariants) {
        const syncId = v.printfulSyncVariantId;
        if (syncId != null && syncId > 0 && !incomingVariantIds.has(syncId)) {
          await db
            .delete(productVariantsTable)
            .where(eq(productVariantsTable.id, v.id));
          console.log(`Deleted variant ${v.id} (no longer in Printful)`);
        }
      }
    };

    let existingVariants = await db
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, productId));

    try {
      await runVariantSync(existingVariants);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isInsertOrDuplicate =
        msg.includes("insert") ||
        msg.includes("duplicate") ||
        msg.includes("unique constraint");
      if (isInsertOrDuplicate) {
        // Replace unreferenced variants then retry (fixes stuck rows that find/update missed)
        const deleted = await deleteUnreferencedPrintfulVariants(productId);
        if (deleted > 0) {
          console.log(
            `[Printful sync] Replaced ${deleted} unreferenced variant(s) for product ${productId}, retrying sync`,
          );
          existingVariants = await db
            .select()
            .from(productVariantsTable)
            .where(eq(productVariantsTable.productId, productId));
          await runVariantSync(existingVariants);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  console.log(
    `Updated Printful product ${syncProduct.id} (local: ${productId})`,
  );
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Update a local variant from Printful sync variant data.
 * Keeps or sets variant image (preview/mockup or catalog image).
 */
async function updateLocalVariantFromPrintful(
  variantId: string,
  syncVariant: PrintfulSyncVariant,
  catalogVariantMap?: Map<number, PrintfulCatalogVariant>,
): Promise<void> {
  const now = new Date();
  const priceCents = Math.round(
    Number.parseFloat(syncVariant.retail_price || "0") * 100,
  );

  const imageUrl = getPrintfulVariantImageUrl(syncVariant);

  const size = getVariantSize(syncVariant);
  const color = getVariantColor(syncVariant);

  // Get catalog variant details for colorCode, colorCode2
  const catalogVariant = catalogVariantMap?.get(syncVariant.variant_id);

  await db
    .update(productVariantsTable)
    .set({
      availabilityStatus: syncVariant.availability_status ?? undefined,
      color,
      colorCode: catalogVariant?.color_code ?? undefined,
      colorCode2: catalogVariant?.color_code2 ?? undefined,
      externalId: String(syncVariant.variant_id),
      imageUrl: imageUrl ?? undefined,
      label: syncVariant.name ?? undefined,
      priceCents,
      printfulSyncVariantId: syncVariant.id,
      size,
      sku: syncVariant.sku,
      updatedAt: now,
    })
    .where(eq(productVariantsTable.id, variantId));
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
      if (catalog) {
        displayName = sizeChartDisplayNameFromCatalog(
          catalog.type ?? null,
          catalog.name ?? null,
        );
      }
    } catch {
      // keep default
    }

    // Try without unit first (some catalog products only return one format)
    const noUnitRes = await fetchProductSizeGuideSafe(catalogProductId, {});
    const fromNoUnit = normalizeSizeGuideData(noUnitRes);
    const hasImperial = fromNoUnit?.sizeTables.some(
      (t) => t.unit !== "cm" && t.unit !== "metric",
    );
    const hasMetric = fromNoUnit?.sizeTables.some(
      (t) => t.unit === "cm" || t.unit === "metric",
    );
    let dataImperial = fromNoUnit && hasImperial ? fromNoUnit : null;
    let dataMetric = fromNoUnit && hasMetric ? fromNoUnit : null;
    // If we don't have both, try explicit units in parallel
    if (dataImperial == null || dataMetric == null) {
      const [imperialRes, metricRes] = await Promise.all([
        fetchProductSizeGuideSafe(catalogProductId, { unit: "inches" }),
        fetchProductSizeGuideSafe(catalogProductId, { unit: "cm" }),
      ]);
      if (dataImperial == null)
        dataImperial = normalizeSizeGuideData(imperialRes);
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
        brand: brandTrimmed,
        createdAt: now,
        dataImperial: dataImperial ? JSON.stringify(dataImperial) : null,
        dataMetric: dataMetric ? JSON.stringify(dataMetric) : null,
        displayName,
        id,
        model: modelTrimmed,
        provider: "printful",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          dataImperial: dataImperial ? JSON.stringify(dataImperial) : null,
          dataMetric: dataMetric ? JSON.stringify(dataMetric) : null,
          updatedAt: now,
          // Don't overwrite displayName with "T-Shirts" so hoodies/sweatshirts keep correct label
          ...(displayName !== "T-Shirts" && { displayName }),
        },
        target: [
          sizeChartsTable.provider,
          sizeChartsTable.brand,
          sizeChartsTable.model,
        ],
      });
    return true;
  } catch (err) {
    console.warn(
      "Printful size chart import failed for catalog product",
      catalogProductId,
      err,
    );
    return false;
  }
}

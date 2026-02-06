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

import { eq, isNull, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "~/db";
import {
  productAvailableCountryTable,
  productsTable,
  productVariantsTable,
  productImagesTable,
} from "~/db/schema";
import { applyCategoryAutoRules } from "~/lib/category-auto-assign";
import {
  fetchSyncProducts,
  fetchSyncProduct,
  fetchCatalogProduct,
  fetchCatalogProductShippingCountries,
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
 * Import a single Printful sync product by ID.
 */
export async function importSinglePrintfulProduct(
  printfulSyncProductId: number,
  overwriteExisting = false,
): Promise<{ action: "imported" | "updated" | "skipped"; productId: string }> {
  // Fetch full product details including variants
  const syncProductFull = await fetchSyncProduct(printfulSyncProductId);
  const { sync_product: syncProduct, sync_variants: syncVariants } =
    syncProductFull;

  // Fetch catalog product for description/brand when we have a catalog product id
  let catalogProduct: { brand: string | null; description: string | null } | null =
    null;
  const catalogProductId = syncVariants[0]?.product?.product_id;
  if (catalogProductId != null) {
    try {
      const catalog = await fetchCatalogProduct(catalogProductId);
      if (catalog?.data) {
        catalogProduct = {
          brand: catalog.data.brand ?? null,
          description: catalog.data.description ?? null,
        };
      }
    } catch {
      // Optional: continue without catalog details
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
      return { action: "skipped", productId: existingProduct.id };
    }

    // Update existing product
    await updateLocalProductFromPrintful(
      existingProduct.id,
      syncProduct,
      syncVariants,
      catalogProduct,
    );
    return { action: "updated", productId: existingProduct.id };
  }

  // Create new product
  const productId = await createLocalProductFromPrintful(
    syncProduct,
    syncVariants,
    catalogProduct,
  );
  return { action: "imported", productId };
}

/** Build option definitions (Size, Color) from sync variants for storefront and admin. */
function buildOptionDefinitionsFromVariants(
  syncVariants: PrintfulSyncVariant[],
): Array<{ name: string; values: string[] }> {
  const sizeValues = new Set<string>();
  const colorValues = new Set<string>();
  for (const v of syncVariants) {
    if (v.size?.trim()) sizeValues.add(v.size.trim());
    if (v.color?.trim()) colorValues.add(v.color.trim());
  }
  const options: Array<{ name: string; values: string[] }> = [];
  if (sizeValues.size > 0) {
    options.push({ name: "Size", values: [...sizeValues].sort() });
  }
  if (colorValues.size > 0) {
    options.push({ name: "Color", values: [...colorValues].sort() });
  }
  return options;
}

/** Get variant image URL: prefer preview/mockup from files, fallback to catalog variant image. */
function getPrintfulVariantImageUrl(syncVariant: PrintfulSyncVariant): string | null {
  const previewFile = syncVariant.files?.find(
    (f) => f.type === "preview" || f.type === "mockup",
  );
  const fromFile =
    previewFile?.preview_url || previewFile?.thumbnail_url || null;
  if (fromFile) return fromFile;
  return syncVariant.product?.image ?? null;
}

/** ISO 3166-1 alpha-2 country codes Printful ships to (populates Markets in admin). */
const PRINTFUL_SHIPPING_COUNTRY_CODES = [
  "US", "CA", "MX", "GT", "CU", "HT", "DO", "HN", "NI", "SV", "CR", "PA", "JM",
  "TT", "BZ", "BS", "BB", "AG", "DM", "GD", "KN", "LC", "VC",
  "BR", "AR", "CO", "PE", "VE", "CL", "EC", "BO", "PY", "UY", "GY", "SR",
  "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "PL", "SE", "NO", "DK",
  "FI", "IE", "PT", "CZ", "RO", "HU", "GR", "BG", "HR", "SK", "RS", "UA", "LT",
  "LV", "EE", "SI", "LU", "MT", "CY", "IS", "LI", "AL", "MK", "ME", "BA", "BY",
  "MD", "RU", "TR",
  "ZA", "EG", "NG", "KE", "MA", "GH", "TZ", "ET", "TN", "DZ", "CI", "SN", "CM",
  "UG", "ZW", "LY", "MU", "BW", "NA",
  "CN", "JP", "IN", "KR", "ID", "TH", "VN", "MY", "SG", "PH", "HK", "TW", "AE",
  "SA", "IL", "PK", "BD", "LK", "QA", "KW", "BH", "OM", "JO", "LB", "KZ", "UZ",
  "GE", "AZ", "AM",
  "AU", "NZ", "FJ", "PG", "WS", "TO", "SB", "VU",
];

/**
 * Create a new local product from Printful sync product data.
 */
async function createLocalProductFromPrintful(
  syncProduct: PrintfulSyncProduct,
  syncVariants: PrintfulSyncVariant[],
  catalogProduct: { brand: string | null; description: string | null } | null,
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

  // Description and brand from catalog product; meta description from description
  const description = catalogProduct?.description ?? null;
  const brand = catalogProduct?.brand ?? null;
  const metaDescription =
    description != null && description.length > 0
      ? description
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : null;

  // Primary image: thumbnail or first variant image
  const productImageUrl =
    syncProduct.thumbnail_url ||
    (firstVariant ? getPrintfulVariantImageUrl(firstVariant) : null);

  // Shipping countries from Printful API when available; else static list
  let marketCountryCodes = PRINTFUL_SHIPPING_COUNTRY_CODES;
  if (catalogProductId != null) {
    const apiCountries = await fetchCatalogProductShippingCountries(
      catalogProductId,
    );
    if (apiCountries && apiCountries.length > 0) {
      marketCountryCodes = apiCountries;
    }
  }

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
    hasVariants,
    optionDefinitionsJson,
    published: !syncProduct.is_ignored, // is_ignored = hidden in store
    imageUrl: productImageUrl,
    pageTitle: syncProduct.name,
    metaDescription,
    vendor: "Printful",
    brand,
    sku: productSku,
    countryOfOrigin: null, // Printful catalog API does not expose; set in admin if needed
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

  // Markets: where Printful ships (from API or static list; admin "Markets" and shipping use this)
  for (const code of marketCountryCodes) {
    await db.insert(productAvailableCountryTable).values({
      productId,
      countryCode: code,
    });
  }

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
  catalogProduct: { brand: string | null; description: string | null } | null,
): Promise<void> {
  const now = new Date();

  // Determine price from variants
  const prices = syncVariants
    .map((v) => Number.parseFloat(v.retail_price || "0") * 100)
    .filter((p) => p > 0);
  const priceCents = prices.length > 0 ? Math.min(...prices) : undefined;

  // Product-level SKU when single variant
  const productSku =
    syncVariants.length === 1 && syncVariants[0]!.sku
      ? syncVariants[0]!.sku
      : null;

  const description = catalogProduct?.description ?? undefined;
  const brand = catalogProduct?.brand ?? undefined;
  const metaDescription =
    description != null && description.length > 0
      ? description
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : undefined;

  const optionDefs = buildOptionDefinitionsFromVariants(syncVariants);
  const optionDefinitionsJson =
    optionDefs.length > 0 ? JSON.stringify(optionDefs) : null;
  // Prefer mockup over raw thumbnail
  const productImageUrl =
    (syncVariants[0]
      ? getPrintfulVariantImageUrl(syncVariants[0])
      : undefined) ?? syncProduct.thumbnail_url;

  await db
    .update(productsTable)
    .set({
      name: syncProduct.name,
      imageUrl: productImageUrl ?? syncProduct.thumbnail_url,
      published: !syncProduct.is_ignored,
      hasVariants: syncVariants.length > 1,
      optionDefinitionsJson,
      pageTitle: syncProduct.name,
      vendor: "Printful",
      sku: productSku,
      ...(description !== undefined && { description }),
      ...(brand !== undefined && { brand }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(priceCents != null && { priceCents }),
      updatedAt: now,
      lastSyncedAt: now,
    })
    .where(eq(productsTable.id, productId));

  // Sync product images: mockups first, then thumbnail
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

  // Sync markets (Printful shipping countries from API or static list)
  const catalogProductId = syncVariants[0]?.product?.product_id;
  let marketCountryCodes = PRINTFUL_SHIPPING_COUNTRY_CODES;
  if (catalogProductId != null) {
    const apiCountries = await fetchCatalogProductShippingCountries(
      catalogProductId,
    );
    if (apiCountries && apiCountries.length > 0) {
      marketCountryCodes = apiCountries;
    }
  }
  await db
    .delete(productAvailableCountryTable)
    .where(eq(productAvailableCountryTable.productId, productId));
  for (const code of marketCountryCodes) {
    await db.insert(productAvailableCountryTable).values({
      productId,
      countryCode: code,
    });
  }

  // Sync variants - update existing, create new, delete removed
  const existingVariants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));

  const existingVariantMap = new Map(
    existingVariants.map((v) => [v.printfulSyncVariantId, v]),
  );
  const incomingVariantIds = new Set(syncVariants.map((v) => v.id));

  // Update or create variants
  for (const syncVariant of syncVariants) {
    const existing = existingVariantMap.get(syncVariant.id);
    if (existing) {
      await updateLocalVariantFromPrintful(existing.id, syncVariant);
    } else {
      await createLocalVariantFromPrintful(productId, syncVariant);
    }
  }

  // Delete variants no longer in Printful
  for (const [syncVariantId, localVariant] of existingVariantMap) {
    if (syncVariantId && !incomingVariantIds.has(syncVariantId)) {
      await db
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.id, localVariant.id));
      console.log(`Deleted variant ${localVariant.id} (no longer in Printful)`);
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

  await db.insert(productVariantsTable).values({
    id: variantId,
    productId,
    externalId: String(syncVariant.variant_id), // Printful catalog variant ID for ordering
    printfulSyncVariantId: syncVariant.id,
    size: syncVariant.size,
    color: syncVariant.color,
    sku: syncVariant.sku,
    priceCents,
    imageUrl,
    createdAt: now,
    updatedAt: now,
  });

  return variantId;
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

  await db
    .update(productVariantsTable)
    .set({
      externalId: String(syncVariant.variant_id),
      size: syncVariant.size,
      color: syncVariant.color,
      sku: syncVariant.sku,
      priceCents,
      imageUrl: imageUrl ?? undefined,
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

  try {
    // Update product-level fields (name, thumbnail)
    // Note: Printful V1 Sync Products API only supports: name, thumbnail, external_id, is_ignored
    await updateSyncProduct(product.printfulSyncProductId, {
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
    });

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

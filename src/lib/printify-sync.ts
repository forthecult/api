/**
 * Printify Product Synchronization Service
 *
 * Handles bidirectional synchronization between Printify Products and local database:
 * - Import: Pull products from Printify → create/update local products
 * - Export: Push local product changes → update Printify (price, description)
 *
 * Printify products are "finished" products with your designs applied to
 * blueprints. This service syncs those finished products to your store.
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "~/db";
import {
  productAvailableCountryTable,
  productImagesTable,
  productsTable,
  productTagsTable,
  productVariantsTable,
} from "~/db/schema";
import {
  applyCategoryAutoRules,
  syncProductCategoriesWithAutoRules,
} from "~/lib/category-auto-assign";
import { POD_SHIPPING_COUNTRY_CODES } from "~/lib/pod-shipping-countries";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { slugify } from "~/lib/slugify";

import {
  confirmPrintifyPublishingSucceeded,
  fetchPrintifyBlueprint,
  fetchPrintifyGpsr,
  fetchPrintifyProduct,
  fetchPrintifyProducts,
  fetchPrintifyShippingInfo,
  fetchPrintifyVariants,
  getPrintifyIfConfigured,
  type PrintifyProduct,
  reportPrintifyPublishingFailed,
  unpublishPrintifyProduct,
  updatePrintifyProduct,
} from "./printify";

// ============================================================================
// Types
// ============================================================================

export interface PrintifyProductExportResult {
  error?: string;
  printifyProductId?: string;
  success: boolean;
}

export interface PrintifySyncResult {
  errors: string[];
  imported: number;
  skipped: number;
  success: boolean;
  updated: number;
}

// ============================================================================
// Import: Printify → Backend
// ============================================================================

/**
 * Import all products from Printify to local database.
 * Creates new products or updates existing ones based on printifyProductId.
 */
export async function importAllPrintifyProducts(
  options: {
    /** Overwrite existing product data (name, description, etc.) */
    overwriteExisting?: boolean;
    /** Only import visible products */
    visibleOnly?: boolean;
  } = {},
): Promise<PrintifySyncResult> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return {
      errors: ["Printify not configured"],
      imported: 0,
      skipped: 0,
      success: false,
      updated: 0,
    };
  }

  const result: PrintifySyncResult = {
    errors: [],
    imported: 0,
    skipped: 0,
    success: true,
    updated: 0,
  };

  try {
    // Fetch all products (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchPrintifyProducts(pf.shopId, {
        limit: 50,
        page,
      });

      for (const product of response.data) {
        // Skip non-visible if visibleOnly
        if (options.visibleOnly && !product.visible) {
          result.skipped++;
          continue;
        }

        try {
          const importResult = await importSinglePrintifyProduct(
            product.id,
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
            `Product ${product.id} (${product.title}): ${message}`,
          );
        }
      }

      page++;
      hasMore = response.next_page_url != null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch products: ${message}`);
    result.success = false;
  }

  return result;
}

/**
 * Import a single Printify product by ID.
 */
export async function importSinglePrintifyProduct(
  printifyProductId: string,
  overwriteExisting = false,
): Promise<{ action: "imported" | "skipped" | "updated"; productId: string }> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    throw new Error("Printify not configured");
  }

  // Fetch full product details
  const printifyProduct = await fetchPrintifyProduct(
    pf.shopId,
    printifyProductId,
  );

  // Do not sync unpublished products to the store (Printify "visible" = not hidden in store)
  if (!printifyProduct.visible) {
    const [existingProduct] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.printifyProductId, printifyProductId))
      .limit(1);
    if (existingProduct) {
      await db
        .update(productsTable)
        .set({ published: false, updatedAt: new Date() })
        .where(eq(productsTable.id, existingProduct.id));
    }
    return { action: "skipped", productId: existingProduct?.id ?? "" };
  }

  // Check if we already have this product
  const [existingProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.printifyProductId, printifyProductId))
    .limit(1);

  if (existingProduct) {
    if (!overwriteExisting) {
      // Even when skipping full update, always sync shipping data (countries + handling days)
      // This ensures shipping calculations stay current without overwriting user-edited fields
      await syncShippingDataOnly(existingProduct.id, printifyProduct);
      return { action: "skipped", productId: existingProduct.id };
    }

    // Update existing product
    await updateLocalProductFromPrintify(existingProduct.id, printifyProduct);
    return { action: "updated", productId: existingProduct.id };
  }

  // Create new product
  const productId = await createLocalProductFromPrintify(printifyProduct);
  return { action: "imported", productId };
}

/** REST_OF_THE_WORLD means no country restrictions (ship everywhere). */
const PRINTIFY_REST_OF_WORLD = "REST_OF_THE_WORLD";

/**
 * Push price changes for all Printify products to Printify.
 */
export async function exportAllPrintifyProducts(): Promise<PrintifySyncResult> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return {
      errors: ["Printify not configured"],
      imported: 0,
      skipped: 0,
      success: false,
      updated: 0,
    };
  }

  const result: PrintifySyncResult = {
    errors: [],
    imported: 0,
    skipped: 0,
    success: true,
    updated: 0,
  };

  // Get all Printify products
  const products = await db
    .select({
      id: productsTable.id,
      printifyProductId: productsTable.printifyProductId,
    })
    .from(productsTable)
    .where(eq(productsTable.source, "printify"));

  for (const product of products) {
    if (!product.printifyProductId) {
      result.skipped++;
      continue;
    }

    const exportResult = await exportProductToPrintify(product.id);
    if (exportResult.success) {
      result.updated++;
    } else {
      result.errors.push(`Product ${product.id}: ${exportResult.error}`);
    }
  }

  return result;
}

/**
 * Push local product changes to Printify.
 *
 * Updates all relevant fields that Printify accepts:
 * - title (product name)
 * - description
 * - tags (from productTagsTable)
 * - variant prices
 * - variant enabled status
 *
 * This ensures that when you modify a product in your backend (price, description,
 * SEO, tags), those changes are pushed to Printify so everything stays in sync.
 * When Printify syncs back, it won't overwrite fields it doesn't manage.
 */
export async function exportProductToPrintify(
  productId: string,
): Promise<PrintifyProductExportResult> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return { error: "Printify not configured", success: false };
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

  if (product.source !== "printify" || !product.printifyProductId) {
    return { error: "Product is not a Printify product", success: false };
  }

  // Get local variants (only the ones we offer in our store)
  const localVariants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));

  // Get tags from productTagsTable
  const tags = await db
    .select({ tag: productTagsTable.tag })
    .from(productTagsTable)
    .where(eq(productTagsTable.productId, productId));
  const tagList = tags.map((t) => t.tag);

  try {
    // Printify API requires ALL variants in the request when updating variants.
    // If we send only our enabled variants, the rest can be zeroed → negative margins.
    // Fetch current product from Printify and send full variant list: our prices for
    // variants we offer, existing Printify price + is_enabled: false for the rest.
    const printifyProduct = await fetchPrintifyProduct(
      pf.shopId,
      product.printifyProductId,
    );
    const localByPrintifyId = new Map(
      localVariants
        .filter((v) => v.printifyVariantId)
        .map((v) => [String(v.printifyVariantId), v]),
    );

    // GET shop product often omits variant cost; fetch catalog so we have cost for the floor.
    let catalogCostByVariantId = new Map<number, number>();
    const missingCost = printifyProduct.variants.some(
      (pv) => !pv.cost || Number(pv.cost) <= 0,
    );
    if (missingCost && printifyProduct.blueprint_id && printifyProduct.print_provider_id) {
      try {
        const catalog = await fetchPrintifyVariants(
          printifyProduct.blueprint_id,
          printifyProduct.print_provider_id,
          { showOutOfStock: true },
        );
        const withCost = catalog as {
          variants?: { id: number; cost?: number }[];
        };
        if (withCost.variants?.length) {
          for (const v of withCost.variants) {
            if (v.cost != null && v.cost > 0)
              catalogCostByVariantId.set(v.id, v.cost);
          }
        }
      } catch {
        // continue without catalog costs
      }
    }

    // Ensure we never send a price below cost (avoids negative margin in Printify).
    // Floor = cost + 1 cent and at least 5% above cost (handles rounding/fees in Printify UI).
    const variantUpdates = printifyProduct.variants.map((pv) => {
      const costCents =
        Number(pv.cost) || catalogCostByVariantId.get(pv.id) || 0;
      const minPriceCents =
        costCents > 0
          ? Math.max(costCents + 1, Math.ceil(costCents * 1.05))
          : 0;

      const local = localByPrintifyId.get(String(pv.id));
      if (local) {
        const priceToSend =
          minPriceCents > 0 && local.priceCents < minPriceCents
            ? minPriceCents
            : local.priceCents;
        return {
          id: pv.id,
          is_enabled: true,
          price: priceToSend,
        };
      }
      const currentPrice = Number(pv.price) || 0;
      const priceForDisabled =
        minPriceCents > 0 && currentPrice < minPriceCents
          ? minPriceCents
          : currentPrice;
      return {
        id: pv.id,
        is_enabled: false,
        price: priceForDisabled,
      };
    });

    // Images only flow inbound (Printify → store), never outbound.
    // Only sync content fields: title, description, tags, and variant prices.
    await updatePrintifyProduct(pf.shopId, product.printifyProductId, {
      description: product.description || undefined,
      tags: tagList.length > 0 ? tagList : undefined,
      title: product.name,
      variants: variantUpdates,
    });

    // Update product last synced timestamp
    await db
      .update(productsTable)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(productsTable.id, productId));

    return { printifyProductId: product.printifyProductId, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isDisabledForEditing =
      message.includes("8252") || /disabled for editing/i.test(message);
    if (isDisabledForEditing) {
      return {
        error:
          "Product is in Publishing in Printify; Printify blocks edits until it is Published. Register webhooks, then delete and re-publish the product in Printify to clear status.",
        success: false,
      };
    }
    return { error: message, success: false };
  }
}

/**
 * Get sync status for a product.
 */
export async function getPrintifyProductSyncStatus(productId: string): Promise<{
  error?: string;
  lastSyncedAt: Date | null;
  printifyProductId: null | string;
  synced: boolean;
}> {
  const [product] = await db
    .select({
      lastSyncedAt: productsTable.lastSyncedAt,
      printifyProductId: productsTable.printifyProductId,
      source: productsTable.source,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return {
      error: "Product not found",
      lastSyncedAt: null,
      printifyProductId: null,
      synced: false,
    };
  }

  return {
    lastSyncedAt: product.lastSyncedAt,
    printifyProductId: product.printifyProductId,
    synced: product.source === "printify" && product.printifyProductId != null,
  };
}

/**
 * Handle Printify product:deleted webhook event.
 * Called when a product is deleted in Printify.
 */
export async function handlePrintifyProductDeleted(data: {
  id: string;
}): Promise<{ error?: string; success: boolean }> {
  try {
    // Find and unpublish the local product
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.printifyProductId, data.id))
      .limit(1);

    if (!product) {
      // Product doesn't exist locally - nothing to do
      return { success: true };
    }

    // Notify Printify the product is unpublished from our store
    const pf = getPrintifyIfConfigured();
    if (pf) {
      try {
        await unpublishPrintifyProduct(pf.shopId, data.id);
      } catch {
        // Best-effort: product may already be deleted in Printify
      }
    }

    // Unpublish the product (safer than deleting - keeps historical data)
    await db
      .update(productsTable)
      .set({
        printifyProductId: null, // Unlink from Printify
        published: false,
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, product.id));

    console.log(`Unpublished product ${product.id} (Printify product deleted)`);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product:deleted:", message);
    return { error: message, success: false };
  }
}

/**
 * Handle Printify product:publish:started webhook event.
 * Called when a product is created/published in Printify.
 *
 * After importing the product, calls publishing_succeeded.json to complete the
 * 3-step publish handshake and clear the "Publishing" status in Printify:
 *   1. Printify fires product:publish:started webhook → we return 200 immediately
 *   2. We import/update the product in our store (this function)
 *   3. We call publishing_succeeded.json with our local product ID and slug
 *
 * Without step 3, Printify keeps the product stuck in "Publishing" indefinitely.
 */
export async function handlePrintifyProductPublished(data: {
  id: string;
}): Promise<{ error?: string; success: boolean }> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return { error: "Printify not configured", success: false };
  }

  try {
    const result = await importSinglePrintifyProduct(data.id, false);

    // Complete the publish handshake: tell Printify we successfully listed the product.
    // This clears the "Publishing" status in Printify.
    if (result.productId) {
      // Look up the product's slug for the handle
      const [product] = await db
        .select({ slug: productsTable.slug })
        .from(productsTable)
        .where(eq(productsTable.id, result.productId))
        .limit(1);

      const handle = product?.slug
        ? `/products/${product.slug}`
        : `/products/${result.productId}`;
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

      const confirmResult = await confirmPrintifyPublishingSucceeded(
        pf.shopId,
        data.id,
        {
          handle: appUrl ? `${appUrl}${handle}` : handle,
          id: result.productId,
        },
      );

      if (!confirmResult.success) {
        console.warn(
          `Printify publishing_succeeded failed for ${data.id}: ${confirmResult.error}`,
        );
        // Don't fail the import just because the confirmation failed
      } else {
        console.log(
          `Printify product ${data.id} publishing confirmed (local: ${result.productId})`,
        );
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product:publish:started:", message);

    // Tell Printify publishing failed so the product doesn't stay stuck in "Publishing"
    try {
      await reportPrintifyPublishingFailed(
        pf.shopId,
        data.id,
        `Import failed: ${message}`,
      );
    } catch (reportErr) {
      console.error(
        "Failed to report publishing_failed to Printify:",
        reportErr,
      );
    }

    return { error: message, success: false };
  }
}

/**
 * List all Printify products from the API (not local DB).
 * Useful for admin UI to show what's available to import.
 */
export async function listAvailablePrintifyProducts(): Promise<{
  error?: string;
  products: PrintifyProduct[];
}> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return { error: "Printify not configured", products: [] };
  }

  try {
    const allProducts: PrintifyProduct[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchPrintifyProducts(pf.shopId, {
        limit: 50,
        page,
      });
      allProducts.push(...response.data);
      page++;
      hasMore = response.next_page_url != null;
    }

    return { products: allProducts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, products: [] };
  }
}

/**
 * Build option definitions for storefront from Printify product.options.
 * Only includes option values that appear in the given enabled variants,
 * so the store never shows sizes/options that weren't selected in Printify.
 */
function buildOptionDefinitionsFromEnabledVariants(
  product: PrintifyProduct,
  enabledVariants: PrintifyProduct["variants"],
): { name: string; values: string[] }[] {
  if (!product.options?.length || enabledVariants.length === 0) return [];
  return product.options
    .map((opt, optIndex) => {
      const valueIds = new Set(
        enabledVariants
          .map((v) => v.options[optIndex])
          .filter((id): id is number => id != null),
      );
      const values = (opt.values ?? [])
        .filter((v) => valueIds.has(v.id))
        .map((v) => v.title?.trim())
        .filter((t): t is string => Boolean(t));
      return { name: opt.name.trim() || "Option", values };
    })
    .filter((opt) => opt.values.length > 0);
}

/**
 * Create a new local product from Printify product data.
 */
async function createLocalProductFromPrintify(
  printifyProduct: PrintifyProduct,
): Promise<string> {
  const productId = nanoid();
  const now = new Date();

  // Generate a unique slug from the product title
  const baseSlug = slugify(printifyProduct.title);
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

  // Only sync variants that are enabled and available in Printify; never sync disabled/unselected options
  const enabledVariants = printifyProduct.variants.filter(
    (v) => v.is_enabled && v.is_available,
  );
  const prices = enabledVariants.map((v) => v.price);
  const priceCents = prices.length > 0 ? Math.min(...prices) : 0;
  // Printify variant cost: typically in cents; if value looks like dollars (< 1000), treat as dollars
  const costs = enabledVariants.map((v) => v.cost);
  const costRaw = costs.length > 0 ? Math.min(...costs) : 0;
  const costPerItemCents =
    costRaw > 0
      ? costRaw < 1000
        ? Math.round(costRaw * 100)
        : Math.round(costRaw)
      : null;

  // Weight from first variant (grams)
  const weightGrams =
    enabledVariants.length > 0 && enabledVariants[0]!.grams > 0
      ? enabledVariants[0]!.grams
      : null;

  // Product-level SKU: use single variant's sku when only one variant
  const productSku =
    enabledVariants.length === 1 && enabledVariants[0]!.sku
      ? enabledVariants[0]!.sku
      : null;

  // Page title and meta description from title/description when not provided by import
  const pageTitle = printifyProduct.title;
  const rawDesc = printifyProduct.description || "";
  const metaDescription =
    rawDesc.length > 0
      ? rawDesc
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : null;

  // Determine if it has multiple variants
  const hasVariants = enabledVariants.length > 1;

  // Get default image
  const defaultImage = printifyProduct.images.find((img) => img.is_default);
  const imageUrl = defaultImage?.src || printifyProduct.images[0]?.src || null;

  // Shipping data (countries + handling days) from catalog API; blueprint for brand/model; GPSR
  const pf = getPrintifyIfConfigured();
  const [shippingData, blueprint, gpsrData] = await Promise.all([
    getPrintifyShippingData(
      printifyProduct.blueprint_id,
      printifyProduct.print_provider_id,
    ),
    fetchPrintifyBlueprint(printifyProduct.blueprint_id).catch(() => null),
    pf
      ? fetchPrintifyGpsr(pf.shopId, printifyProduct.id).catch(() => null)
      : null,
  ]);

  const brand = blueprint?.brand?.trim() ?? null;
  const model = blueprint?.model?.trim() ?? null;

  const optionDefs = hasVariants
    ? buildOptionDefinitionsFromEnabledVariants(
        printifyProduct,
        enabledVariants,
      )
    : [];
  const optionDefinitionsJson =
    optionDefs.length > 0 ? JSON.stringify(optionDefs) : null;

  // Create product
  await db.insert(productsTable).values({
    brand,
    continueSellingWhenOutOfStock: true, // POD products are made to order
    costPerItemCents,
    countryOfOrigin: printifyProduct.country_of_origin?.trim() || null,
    createdAt: now,
    description: printifyProduct.description || null,
    externalId: String(printifyProduct.blueprint_id), // Store blueprint ID
    // EU GPSR compliance data
    gpsrJson: gpsrData ?? undefined,
    handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
    handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
    hasVariants,
    hsCode: printifyProduct.hs_code?.trim() || null,
    id: productId,
    imageUrl,
    lastSyncedAt: now,
    metaDescription,
    model,
    name: printifyProduct.title,
    optionDefinitionsJson,
    pageTitle,
    physicalProduct: true,
    priceCents,
    printifyEconomyEligible:
      printifyProduct.is_economy_shipping_eligible ?? false,
    printifyEconomyEnabled:
      printifyProduct.is_economy_shipping_enabled ?? false,
    // Printify shipping eligibility flags
    printifyExpressEligible:
      printifyProduct.is_printify_express_eligible ?? false,
    printifyExpressEnabled:
      printifyProduct.is_printify_express_enabled ?? false,
    printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
    printifyProductId: printifyProduct.id,
    published: printifyProduct.visible, // visible = not "hide in store"
    sku: productSku,
    slug,
    source: "printify",
    trackQuantity: false, // Printify manages inventory
    updatedAt: now,
    vendor: "Printify",
    weightGrams,
    weightUnit: weightGrams ? "kg" : null,
  });

  await applyCategoryAutoRules({
    brand: brand ?? null,
    createdAt: now,
    id: productId,
    name: printifyProduct.title,
    tags: printifyProduct.tags ?? [],
  });

  // Create variants
  for (const variant of enabledVariants) {
    await createLocalVariantFromPrintify(productId, printifyProduct, variant);
  }

  // Add images
  let sortOrder = 0;
  for (const img of printifyProduct.images) {
    await db.insert(productImagesTable).values({
      alt: printifyProduct.title,
      id: nanoid(),
      productId,
      sortOrder: sortOrder++,
      url: img.src,
    });
  }

  // Add tags from Printify
  if (printifyProduct.tags && printifyProduct.tags.length > 0) {
    await db.insert(productTagsTable).values(
      printifyProduct.tags.map((tag) => ({
        productId,
        tag,
      })),
    );
  }

  // Shipping countries from Printify catalog API (or fallback when REST_OF_WORLD/empty)
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);

  // Re-host mockup images to UploadThing in background (SEO, our CDN)
  void import("~/lib/upload-product-mockups")
    .then((m) => m.triggerMockupUploadForProduct(productId))
    .catch((err) =>
      console.warn("Printify post-sync mockup upload failed:", err),
    );

  console.log(
    `Imported Printify product ${printifyProduct.id} as ${productId}`,
  );
  return productId;
}

/**
 * Create a local variant from Printify variant data.
 */
async function createLocalVariantFromPrintify(
  productId: string,
  printifyProduct: PrintifyProduct,
  variant: PrintifyProduct["variants"][0],
): Promise<string> {
  const variantId = nanoid();
  const now = new Date();

  const variantOptions = getVariantOptions(printifyProduct, variant);
  const label = getVariantLabel(printifyProduct, variant);

  const variantImage = printifyProduct.images.find((img) =>
    img.variant_ids.includes(variant.id),
  );
  const imageUrl = variantImage?.src || null;

  await db.insert(productVariantsTable).values({
    color: variantOptions.color,
    createdAt: now,
    externalId: String(variant.id),
    gender: variantOptions.gender,
    id: variantId,
    imageUrl,
    label,
    priceCents: variant.price,
    printifyVariantId: String(variant.id),
    productId,
    size: variantOptions.size,
    sku: variant.sku || null,
    updatedAt: now,
    weightGrams: variant.grams || null,
  });

  return variantId;
}

/**
 * Fetch shipping countries and handling days in one catalog API call.
 */
async function getPrintifyShippingData(
  blueprintId: number,
  printProviderId: number,
): Promise<{
  countryCodes: null | string[];
  handlingDaysMax: null | number;
  handlingDaysMin: null | number;
}> {
  try {
    const shipping = await fetchPrintifyShippingInfo(
      blueprintId,
      printProviderId,
    );
    const allCountries = new Set<string>();
    let hasRestOfWorld = false;
    for (const profile of shipping.profiles ?? []) {
      for (const c of profile.countries ?? []) {
        if (c === PRINTIFY_REST_OF_WORLD) {
          hasRestOfWorld = true;
        } else if (typeof c === "string" && c.length === 2) {
          allCountries.add(c.toUpperCase());
        }
      }
    }
    const countryCodes =
      hasRestOfWorld || allCountries.size === 0 ? null : [...allCountries];

    const ht = shipping.handling_time;
    const handlingResult =
      ht && typeof ht.value === "number"
        ? printifyHandlingToDays(ht.value, ht.unit ?? "business_days")
        : null;

    return {
      countryCodes,
      handlingDaysMax: handlingResult?.max ?? null,
      handlingDaysMin: handlingResult?.min ?? null,
    };
  } catch (err) {
    console.warn(
      `Printify shipping info failed for blueprint ${blueprintId} provider ${printProviderId}:`,
      err instanceof Error ? err.message : err,
    );
    return {
      countryCodes: null,
      handlingDaysMax: null,
      handlingDaysMin: null,
    };
  }
}

/**
 * Build display label for a variant. Printify often returns variant.title as "Default" for
 * phone cases and other products; use option value titles (e.g. "iPhone 16", "White / M") instead.
 */
function getVariantLabel(
  product: PrintifyProduct,
  variant: PrintifyProduct["variants"][0],
): null | string {
  const title = variant.title?.trim();
  if (title && title.toLowerCase() !== "default") {
    return title;
  }
  const opts = getVariantOptions(product, variant);
  const parts = [opts.color, opts.size, opts.gender].filter((t): t is string =>
    Boolean(t?.trim()),
  );
  return parts.length > 0 ? parts.join(" / ") : title || null;
}

// ============================================================================
// Export: Backend → Printify
// ============================================================================

/**
 * Extract size, color, and first other option (e.g. Phone Model) from Printify variant options.
 * Front-end maps option names to color / size / gender; we store "other" (e.g. device) in gender.
 */
function getVariantOptions(
  product: PrintifyProduct,
  variant: PrintifyProduct["variants"][0],
): { color: null | string; gender: null | string; size: null | string } {
  let size: null | string = null;
  let color: null | string = null;
  let gender: null | string = null;

  for (let i = 0; i < variant.options.length; i++) {
    const optionValueId = variant.options[i];
    const optionDef = product.options[i];
    if (!optionDef) continue;

    const optionValue = optionDef.values.find((v) => v.id === optionValueId);
    if (!optionValue) continue;

    const optionName = optionDef.name.toLowerCase();
    if (optionName.includes("size")) {
      size = optionValue.title;
    } else if (optionName.includes("color") || optionName.includes("colour")) {
      color = optionValue.title;
    } else {
      // First "other" option (e.g. Phone Model, Device) → store in gender for storefront
      if (!gender) gender = optionValue.title;
    }
  }

  return { color, gender, size };
}

/**
 * Convert Printify handling_time to business days (min and max).
 * Unit can be "business_days", "days", "hours". Returns { min, max } or null.
 */
function printifyHandlingToDays(
  value: number,
  unit: string,
): null | { max: number; min: number } {
  if (value <= 0 || !Number.isFinite(value)) return null;
  let days: number;
  const u = (unit || "").toLowerCase();
  if (u === "business_days" || u === "days") {
    days = Math.round(value);
  } else if (u === "hours") {
    days = Math.max(1, Math.round(value / 24));
  } else {
    days = Math.round(value);
  }
  return { max: days + 1, min: days };
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Sync product available countries. When API returns null/empty (e.g. REST_OF_WORLD),
 * use comprehensive fallback so Markets are populated.
 */
async function syncPrintifyProductCountries(
  productId: string,
  countryCodes: null | string[],
): Promise<void> {
  await db
    .delete(productAvailableCountryTable)
    .where(eq(productAvailableCountryTable.productId, productId));

  let allowed: string[];
  if (countryCodes != null && countryCodes.length > 0) {
    allowed = countryCodes.filter((c) => !isShippingExcluded(c));
  } else {
    allowed = [...POD_SHIPPING_COUNTRY_CODES].filter(
      (c) => !isShippingExcluded(c),
    );
  }
  if (allowed.length > 0) {
    await db.insert(productAvailableCountryTable).values(
      allowed.map((countryCode) => ({
        countryCode,
        productId,
      })),
    );
  }
}

/**
 * Sync only shipping-related data for an existing product.
 * Called when overwriteExisting=false to ensure shipping calculations stay current
 * without overwriting user-edited fields like name, description, SEO, etc.
 */
async function syncShippingDataOnly(
  productId: string,
  printifyProduct: PrintifyProduct,
): Promise<void> {
  const shippingData = await getPrintifyShippingData(
    printifyProduct.blueprint_id,
    printifyProduct.print_provider_id,
  );

  // Update only shipping-related fields on the product (including express/economy eligibility)
  await db
    .update(productsTable)
    .set({
      handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
      handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
      lastSyncedAt: new Date(),
      printifyEconomyEligible:
        printifyProduct.is_economy_shipping_eligible ?? false,
      printifyEconomyEnabled:
        printifyProduct.is_economy_shipping_enabled ?? false,
      printifyExpressEligible:
        printifyProduct.is_printify_express_eligible ?? false,
      printifyExpressEnabled:
        printifyProduct.is_printify_express_enabled ?? false,
      printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
    })
    .where(eq(productsTable.id, productId));

  // Sync shipping countries
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Update an existing local product from Printify product data.
 *
 * IMPORTANT: This preserves local-only fields that shouldn't be overwritten:
 * - metaDescription, pageTitle (SEO fields) - Printify doesn't have these
 * - slug (user-defined URL)
 * - description is synced FROM Printify (Printify does support description)
 * - tags are synced FROM Printify (Printify does support tags)
 *
 * Fields that ARE updated from Printify:
 * - name (title), description, imageUrl, published, hasVariants, priceCents
 */
async function updateLocalProductFromPrintify(
  productId: string,
  printifyProduct: PrintifyProduct,
): Promise<void> {
  const now = new Date();

  const pfConfig = getPrintifyIfConfigured();
  const [shippingData, blueprint, gpsrData] = await Promise.all([
    getPrintifyShippingData(
      printifyProduct.blueprint_id,
      printifyProduct.print_provider_id,
    ),
    fetchPrintifyBlueprint(printifyProduct.blueprint_id).catch(() => null),
    pfConfig
      ? fetchPrintifyGpsr(pfConfig.shopId, printifyProduct.id).catch(() => null)
      : null,
  ]);
  const brand = blueprint?.brand?.trim() ?? null;
  const model = blueprint?.model?.trim() ?? null;

  const [productRow] = await db
    .select({ createdAt: productsTable.createdAt })
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  const productCreatedAt = productRow?.createdAt ?? now;

  // Only sync variants that are enabled and available in Printify; never sync disabled/unselected options
  const enabledVariants = printifyProduct.variants.filter(
    (v) => v.is_enabled && v.is_available,
  );
  const prices = enabledVariants.map((v) => v.price);
  const priceCents = prices.length > 0 ? Math.min(...prices) : undefined;
  const costs = enabledVariants.map((v) => v.cost);
  const costRaw = costs.length > 0 ? Math.min(...costs) : 0;
  const costPerItemCents =
    costRaw > 0
      ? costRaw < 1000
        ? Math.round(costRaw * 100)
        : Math.round(costRaw)
      : null;
  const weightGrams =
    enabledVariants.length > 0 && enabledVariants[0]!.grams > 0
      ? enabledVariants[0]!.grams
      : null;
  const productSku =
    enabledVariants.length === 1 && enabledVariants[0]!.sku
      ? enabledVariants[0]!.sku
      : null;
  const rawDesc = printifyProduct.description || "";
  const metaDescription =
    rawDesc.length > 0
      ? rawDesc
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)
      : null;

  // Get default image
  const defaultImage = printifyProduct.images.find((img) => img.is_default);
  const imageUrl = defaultImage?.src || printifyProduct.images[0]?.src || null;

  const optionDefs =
    enabledVariants.length > 1
      ? buildOptionDefinitionsFromEnabledVariants(
          printifyProduct,
          enabledVariants,
        )
      : [];
  const optionDefinitionsJson =
    optionDefs.length > 0 ? JSON.stringify(optionDefs) : null;

  // Update product - Printify-managed fields (including cost, weight, vendor, sku, handling days, print provider)
  await db
    .update(productsTable)
    .set({
      brand,
      costPerItemCents,
      countryOfOrigin: printifyProduct.country_of_origin?.trim() || null,
      description: printifyProduct.description || null,
      // EU GPSR compliance data
      gpsrJson: gpsrData ?? undefined,
      handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
      handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
      hasVariants: enabledVariants.length > 1,
      hsCode: printifyProduct.hs_code?.trim() || null,
      imageUrl,
      metaDescription,
      model,
      name: printifyProduct.title,
      optionDefinitionsJson,
      pageTitle: printifyProduct.title,
      printifyEconomyEligible:
        printifyProduct.is_economy_shipping_eligible ?? false,
      printifyEconomyEnabled:
        printifyProduct.is_economy_shipping_enabled ?? false,
      // Printify shipping eligibility flags
      printifyExpressEligible:
        printifyProduct.is_printify_express_eligible ?? false,
      printifyExpressEnabled:
        printifyProduct.is_printify_express_enabled ?? false,
      printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
      published: printifyProduct.visible,
      sku: productSku,
      vendor: "Printify",
      weightGrams,
      weightUnit: weightGrams ? "kg" : null,
      ...(priceCents != null && { priceCents }),
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(productsTable.id, productId));

  // Sync tags from Printify to local productTagsTable
  // First, remove existing tags for this product
  await db
    .delete(productTagsTable)
    .where(eq(productTagsTable.productId, productId));

  // Then add tags from Printify
  if (printifyProduct.tags && printifyProduct.tags.length > 0) {
    await db.insert(productTagsTable).values(
      printifyProduct.tags.map((tag) => ({
        productId,
        tag,
      })),
    );
  }

  await syncProductCategoriesWithAutoRules({
    brand: brand ?? null,
    createdAt: productCreatedAt,
    id: productId,
    name: printifyProduct.title,
    tags: printifyProduct.tags ?? [],
  });

  // Sync variants - update existing, create new, delete removed
  const existingVariants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));

  const existingVariantMap = new Map(
    existingVariants.map((v) => [v.printifyVariantId, v]),
  );
  const incomingVariantIds = new Set(enabledVariants.map((v) => String(v.id)));

  // Update or create variants
  for (const variant of enabledVariants) {
    const existing = existingVariantMap.get(String(variant.id));
    if (existing) {
      await updateLocalVariantFromPrintify(
        existing.id,
        printifyProduct,
        variant,
      );
    } else {
      await createLocalVariantFromPrintify(productId, printifyProduct, variant);
    }
  }

  // Delete variants no longer in Printify (or disabled)
  for (const [printifyVariantId, localVariant] of existingVariantMap) {
    if (printifyVariantId && !incomingVariantIds.has(printifyVariantId)) {
      await db
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.id, localVariant.id));
      console.log(
        `Deleted variant ${localVariant.id} (no longer enabled in Printify)`,
      );
    }
  }

  // Sync product_images from Printify (so re-sync repopulates mockup URLs for re-host to UploadThing)
  await db
    .delete(productImagesTable)
    .where(eq(productImagesTable.productId, productId));
  let sortOrder = 0;
  for (const img of printifyProduct.images) {
    await db.insert(productImagesTable).values({
      alt: printifyProduct.title,
      id: nanoid(),
      productId,
      sortOrder: sortOrder++,
      url: img.src,
    });
  }

  // Sync shipping countries from Printify catalog API (or fallback)
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);

  // Re-host mockup images to UploadThing in background (SEO, our CDN)
  void import("~/lib/upload-product-mockups")
    .then((m) => m.triggerMockupUploadForProduct(productId))
    .catch((err) =>
      console.warn("Printify post-sync mockup upload failed:", err),
    );

  console.log(
    `Updated Printify product ${printifyProduct.id} (local: ${productId})`,
  );
}

/**
 * Update a local variant from Printify variant data.
 */
async function updateLocalVariantFromPrintify(
  variantId: string,
  printifyProduct: PrintifyProduct,
  variant: PrintifyProduct["variants"][0],
): Promise<void> {
  const now = new Date();

  const variantOptions = getVariantOptions(printifyProduct, variant);
  const label = getVariantLabel(printifyProduct, variant);

  const variantImage = printifyProduct.images.find((img) =>
    img.variant_ids.includes(variant.id),
  );
  const imageUrl = variantImage?.src || null;

  await db
    .update(productVariantsTable)
    .set({
      color: variantOptions.color,
      externalId: String(variant.id),
      gender: variantOptions.gender,
      label: label ?? undefined,
      priceCents: variant.price,
      size: variantOptions.size,
      sku: variant.sku || null,
      weightGrams: variant.grams || null,
      ...(imageUrl && { imageUrl }),
      updatedAt: now,
    })
    .where(eq(productVariantsTable.id, variantId));
}

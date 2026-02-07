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
  productsTable,
  productVariantsTable,
  productImagesTable,
  productTagsTable,
} from "~/db/schema";
import {
  applyCategoryAutoRules,
  syncProductCategoriesWithAutoRules,
} from "~/lib/category-auto-assign";
import {
  fetchPrintifyProducts,
  fetchPrintifyProduct,
  fetchPrintifyShippingInfo,
  updatePrintifyProduct,
  getPrintifyIfConfigured,
  type PrintifyProduct,
} from "./printify";

// ============================================================================
// Types
// ============================================================================

export type PrintifySyncResult = {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export type PrintifyProductExportResult = {
  success: boolean;
  printifyProductId?: string;
  error?: string;
};

// ============================================================================
// Import: Printify → Backend
// ============================================================================

/**
 * Import all products from Printify to local database.
 * Creates new products or updates existing ones based on printifyProductId.
 */
export async function importAllPrintifyProducts(
  options: {
    /** Only import visible products */
    visibleOnly?: boolean;
    /** Overwrite existing product data (name, description, etc.) */
    overwriteExisting?: boolean;
  } = {},
): Promise<PrintifySyncResult> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Printify not configured"],
    };
  }

  const result: PrintifySyncResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Fetch all products (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchPrintifyProducts(pf.shopId, {
        page,
        limit: 50,
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
): Promise<{ action: "imported" | "updated" | "skipped"; productId: string }> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    throw new Error("Printify not configured");
  }

  // Fetch full product details
  const printifyProduct = await fetchPrintifyProduct(
    pf.shopId,
    printifyProductId,
  );

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
 * Convert Printify handling_time to business days (min and max).
 * Unit can be "business_days", "days", "hours". Returns { min, max } or null.
 */
function printifyHandlingToDays(
  value: number,
  unit: string,
): { min: number; max: number } | null {
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
  return { min: days, max: days + 1 };
}

/**
 * Fetch shipping countries and handling days in one catalog API call.
 */
async function getPrintifyShippingData(
  blueprintId: number,
  printProviderId: number,
): Promise<{
  countryCodes: string[] | null;
  handlingDaysMin: number | null;
  handlingDaysMax: number | null;
}> {
  try {
    const shipping = await fetchPrintifyShippingInfo(blueprintId, printProviderId);
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
      hasRestOfWorld || allCountries.size === 0
        ? null
        : [...allCountries];

    const ht = shipping.handling_time;
    const handlingResult =
      ht && typeof ht.value === "number"
        ? printifyHandlingToDays(ht.value, ht.unit ?? "business_days")
        : null;

    return {
      countryCodes,
      handlingDaysMin: handlingResult?.min ?? null,
      handlingDaysMax: handlingResult?.max ?? null,
    };
  } catch (err) {
    console.warn(
      `Printify shipping info failed for blueprint ${blueprintId} provider ${printProviderId}:`,
      err instanceof Error ? err.message : err,
    );
    return {
      countryCodes: null,
      handlingDaysMin: null,
      handlingDaysMax: null,
    };
  }
}

/**
 * Sync product available countries. Empty list = available everywhere.
 * Caller should pass countryCodes from getPrintifyShippingData to avoid duplicate API calls.
 */
async function syncPrintifyProductCountries(
  productId: string,
  countryCodes: string[] | null,
): Promise<void> {
  await db
    .delete(productAvailableCountryTable)
    .where(eq(productAvailableCountryTable.productId, productId));

  if (countryCodes && countryCodes.length > 0) {
    await db.insert(productAvailableCountryTable).values(
      countryCodes.map((countryCode) => ({
        productId,
        countryCode,
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

  // Update only shipping-related fields on the product
  await db
    .update(productsTable)
    .set({
      handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
      handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
      printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
      lastSyncedAt: new Date(),
    })
    .where(eq(productsTable.id, productId));

  // Sync shipping countries
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);
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

  // Determine price and cost from enabled variants (use lowest price; cost = first/min cost)
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

  // Shipping data (countries + handling days) from catalog API; blueprint for brand/model
  const [shippingData, blueprint] = await Promise.all([
    getPrintifyShippingData(
      printifyProduct.blueprint_id,
      printifyProduct.print_provider_id,
    ),
    fetchPrintifyBlueprint(printifyProduct.blueprint_id).catch(() => null),
  ]);

  const brand = blueprint?.brand?.trim() ?? null;
  const model = blueprint?.model?.trim() ?? null;

  // Create product
  await db.insert(productsTable).values({
    id: productId,
    name: printifyProduct.title,
    description: printifyProduct.description || null,
    slug,
    source: "printify",
    externalId: String(printifyProduct.blueprint_id), // Store blueprint ID
    printifyProductId: printifyProduct.id,
    printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
    priceCents,
    hasVariants,
    published: printifyProduct.visible, // visible = not "hide in store"
    imageUrl,
    pageTitle,
    metaDescription,
    costPerItemCents,
    weightGrams,
    weightUnit: weightGrams ? "kg" : null,
    vendor: "Printify",
    brand: null, // Printify product API does not expose brand
    sku: productSku,
    countryOfOrigin: printifyProduct.country_of_origin?.trim() || null,
    hsCode: printifyProduct.hs_code?.trim() || null,
    handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
    handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    physicalProduct: true,
    trackQuantity: false, // Printify manages inventory
    continueSellingWhenOutOfStock: true, // POD products are made to order
  });

  await applyCategoryAutoRules({
    id: productId,
    name: printifyProduct.title,
    brand: brand ?? undefined,
    createdAt: now,
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
      id: nanoid(),
      productId,
      url: img.src,
      alt: printifyProduct.title,
      sortOrder: sortOrder++,
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

  // Shipping countries from Printify catalog API (already fetched above)
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);

  console.log(
    `Imported Printify product ${printifyProduct.id} as ${productId}`,
  );
  return productId;
}

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

  const shippingData = await getPrintifyShippingData(
    printifyProduct.blueprint_id,
    printifyProduct.print_provider_id,
  );

  const [productRow] = await db
    .select({ createdAt: productsTable.createdAt })
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  const productCreatedAt = productRow?.createdAt ?? now;

  // Determine price and cost from enabled variants
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

  // Update product - Printify-managed fields (including cost, weight, vendor, sku, handling days, print provider)
  await db
    .update(productsTable)
    .set({
      name: printifyProduct.title,
      description: printifyProduct.description || null,
      imageUrl,
      published: printifyProduct.visible,
      hasVariants: enabledVariants.length > 1,
      pageTitle: printifyProduct.title,
      metaDescription,
      costPerItemCents,
      weightGrams,
      weightUnit: weightGrams ? "kg" : null,
      vendor: "Printify",
      brand,
      model,
      sku: productSku,
      printifyPrintProviderId: printifyProduct.print_provider_id ?? null,
      countryOfOrigin: printifyProduct.country_of_origin?.trim() || null,
      hsCode: printifyProduct.hs_code?.trim() || null,
      handlingDaysMin: shippingData.handlingDaysMin ?? undefined,
      handlingDaysMax: shippingData.handlingDaysMax ?? undefined,
      ...(priceCents != null && { priceCents }),
      updatedAt: now,
      lastSyncedAt: now,
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
    id: productId,
    name: printifyProduct.title,
    brand: brand ?? undefined,
    createdAt: productCreatedAt,
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

  // Sync shipping countries from Printify catalog API
  await syncPrintifyProductCountries(productId, shippingData.countryCodes);

  console.log(
    `Updated Printify product ${printifyProduct.id} (local: ${productId})`,
  );
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

  // Parse variant options to get size/color
  const variantOptions = getVariantOptions(printifyProduct, variant);

  // Get image for this variant
  const variantImage = printifyProduct.images.find((img) =>
    img.variant_ids.includes(variant.id),
  );
  const imageUrl = variantImage?.src || null;

  await db.insert(productVariantsTable).values({
    id: variantId,
    productId,
    externalId: String(variant.id), // Printify variant ID for ordering
    printifyVariantId: String(variant.id),
    size: variantOptions.size,
    color: variantOptions.color,
    sku: variant.sku || null,
    priceCents: variant.price,
    weightGrams: variant.grams || null,
    imageUrl,
    createdAt: now,
    updatedAt: now,
  });

  return variantId;
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

  // Parse variant options
  const variantOptions = getVariantOptions(printifyProduct, variant);

  // Get image for this variant
  const variantImage = printifyProduct.images.find((img) =>
    img.variant_ids.includes(variant.id),
  );
  const imageUrl = variantImage?.src || null;

  await db
    .update(productVariantsTable)
    .set({
      externalId: String(variant.id),
      size: variantOptions.size,
      color: variantOptions.color,
      sku: variant.sku || null,
      priceCents: variant.price,
      weightGrams: variant.grams || null,
      ...(imageUrl && { imageUrl }),
      updatedAt: now,
    })
    .where(eq(productVariantsTable.id, variantId));
}

/**
 * Extract size and color from Printify variant options.
 */
function getVariantOptions(
  product: PrintifyProduct,
  variant: PrintifyProduct["variants"][0],
): { size: string | null; color: string | null } {
  let size: string | null = null;
  let color: string | null = null;

  // variant.options is an array of option value IDs
  // product.options contains the option definitions
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
    }
  }

  return { size, color };
}

// ============================================================================
// Export: Backend → Printify
// ============================================================================

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
    return { success: false, error: "Printify not configured" };
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

  if (product.source !== "printify" || !product.printifyProductId) {
    return { success: false, error: "Product is not a Printify product" };
  }

  // Get variants
  const variants = await db
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
    // Build variant updates with prices
    const variantUpdates = variants
      .filter((v) => v.printifyVariantId)
      .map((v) => ({
        id: Number.parseInt(v.printifyVariantId!, 10),
        price: v.priceCents,
        is_enabled: true,
      }));

    // Update the Printify product with all editable fields
    await updatePrintifyProduct(pf.shopId, product.printifyProductId, {
      title: product.name,
      description: product.description || undefined,
      tags: tagList.length > 0 ? tagList : undefined,
      variants: variantUpdates,
    });

    // Update product last synced timestamp
    await db
      .update(productsTable)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(productsTable.id, productId));

    return { success: true, printifyProductId: product.printifyProductId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Push price changes for all Printify products to Printify.
 */
export async function exportAllPrintifyProducts(): Promise<PrintifySyncResult> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["Printify not configured"],
    };
  }

  const result: PrintifySyncResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
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

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle Printify product:publish:started webhook event.
 * Called when a product is created/published in Printify.
 */
export async function handlePrintifyProductPublished(data: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await importSinglePrintifyProduct(data.id, false);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product:publish:started:", message);
    return { success: false, error: message };
  }
}

/**
 * Handle Printify product:deleted webhook event.
 * Called when a product is deleted in Printify.
 */
export async function handlePrintifyProductDeleted(data: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
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

    // Unpublish the product (safer than deleting - keeps historical data)
    await db
      .update(productsTable)
      .set({
        published: false,
        updatedAt: new Date(),
        printifyProductId: null, // Unlink from Printify
      })
      .where(eq(productsTable.id, product.id));

    console.log(`Unpublished product ${product.id} (Printify product deleted)`);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to handle product:deleted:", message);
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
export async function getPrintifyProductSyncStatus(productId: string): Promise<{
  synced: boolean;
  printifyProductId: string | null;
  lastSyncedAt: Date | null;
  error?: string;
}> {
  const [product] = await db
    .select({
      printifyProductId: productsTable.printifyProductId,
      lastSyncedAt: productsTable.lastSyncedAt,
      source: productsTable.source,
    })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    return {
      synced: false,
      printifyProductId: null,
      lastSyncedAt: null,
      error: "Product not found",
    };
  }

  return {
    synced: product.source === "printify" && product.printifyProductId != null,
    printifyProductId: product.printifyProductId,
    lastSyncedAt: product.lastSyncedAt,
  };
}

/**
 * List all Printify products from the API (not local DB).
 * Useful for admin UI to show what's available to import.
 */
export async function listAvailablePrintifyProducts(): Promise<{
  products: PrintifyProduct[];
  error?: string;
}> {
  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return { products: [], error: "Printify not configured" };
  }

  try {
    const allProducts: PrintifyProduct[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchPrintifyProducts(pf.shopId, {
        page,
        limit: 50,
      });
      allProducts.push(...response.data);
      page++;
      hasMore = response.next_page_url != null;
    }

    return { products: allProducts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { products: [], error: message };
  }
}

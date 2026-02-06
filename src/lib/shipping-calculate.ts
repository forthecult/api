/**
 * Shared shipping calculation logic for POST /api/shipping/calculate and POST /api/shipping/estimate.
 *
 * Supports:
 * - Admin-configured shipping options (flat rate, per-item, free over X)
 * - Printful shipping rates for Printful products
 * - Printify shipping rates for Printify products (via catalog shipping profiles)
 * - Combined shipping when order has multiple vendor types
 * - Country-based shipping restrictions
 */

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "~/db";
import { couponsTable } from "~/db/schema";
import { resolveCouponForCheckout } from "~/lib/coupon";
import {
  brandTable,
  productsTable,
  productVariantsTable,
  productAvailableCountryTable,
  shippingOptionsTable,
} from "~/db/schema";
import { userMeetsTokenHolderCondition } from "~/lib/token-holder-balance";
import {
  fetchShippingRates,
  getPrintfulIfConfigured,
  type PrintfulShippingOrderItem,
  type PrintfulShippingRateOption,
} from "~/lib/printful";
import {
  calculatePrintifyShipping as fetchPrintifyShippingRates,
  getPrintifyIfConfigured,
  type PrintifyShippingRateResult,
} from "~/lib/printify";

import { isShippingExcluded } from "~/lib/shipping-restrictions";
import type { ShippingCalculateInput } from "~/lib/validations/checkout";

type ShippingOptionRow = {
  brandId: string | null;
  countryCode: string | null;
  minOrderCents: number | null;
  maxOrderCents: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  type: "flat" | "per_item" | "flat_plus_per_item" | "free";
  amountCents: number | null;
  additionalItemCents: number | null;
  name: string;
};

function matches(
  opt: ShippingOptionRow,
  orderValueCents: number,
  totalQuantity: number,
  totalWeightGrams: number,
): boolean {
  if (opt.minOrderCents != null && orderValueCents < opt.minOrderCents)
    return false;
  if (opt.maxOrderCents != null && orderValueCents > opt.maxOrderCents)
    return false;
  if (opt.minQuantity != null && totalQuantity < opt.minQuantity) return false;
  if (opt.maxQuantity != null && totalQuantity > opt.maxQuantity) return false;
  if (opt.minWeightGrams != null && totalWeightGrams < opt.minWeightGrams)
    return false;
  if (opt.maxWeightGrams != null && totalWeightGrams > opt.maxWeightGrams)
    return false;
  return true;
}

/** Strip third-party vendor names and normalize to "Standard" or "Express" when not carrier-specific (e.g. FedEx Overnight). */
function normalizeThirdPartyShippingLabel(
  name: string,
  options?: { isExpress?: boolean },
): string {
  const raw = (name ?? "").trim();
  if (!raw) return "Standard";

  const lower = raw.toLowerCase();
  const withoutVendor = raw
    .replace(/^printify\s+/i, "")
    .replace(/^printful\s+/i, "")
    .trim();
  const rest = withoutVendor.toLowerCase();

  const isExpressKeyword =
    /\b(express|overnight|rush|2-?day|priority\s+express)\b/i.test(lower) ||
    options?.isExpress === true;

  if (!withoutVendor) return isExpressKeyword ? "Express" : "Standard";

  const looksSpecific =
    /\b(fedex|usps|ups|dhl|dpd|royal\s+mail|carrier)\b/i.test(rest) ||
    /\b(overnight|priority\s+mail|ground|first\s+class)\b/i.test(rest);
  if (looksSpecific) return withoutVendor;

  return isExpressKeyword ? "Express" : "Standard";
}

export const ZERO_SHIPPING = {
  shippingCents: 0,
  label: null as string | null,
  freeShipping: false,
  printfulShipping: null as PrintfulShippingRateOption | null,
  printfulShippingCents: 0,
  printifyShippingCents: 0,
  adminShippingCents: 0,
  canShipToCountry: true,
  unavailableProducts: [] as string[],
  /** "express" when any selected admin option is express (e.g. phone required at checkout). */
  shippingSpeed: "standard" as "standard" | "express",
};

export type ShippingResult =
  | typeof ZERO_SHIPPING
  | {
      shippingCents: number;
      label: string | null;
      freeShipping: boolean;
      printfulShipping: PrintfulShippingRateOption | null;
      printfulShippingCents: number;
      printifyShippingCents: number;
      adminShippingCents: number;
      canShipToCountry: boolean;
      unavailableProducts: string[];
      shippingSpeed: "standard" | "express";
    };

type ExtendedShippingInput = ShippingCalculateInput & {
  stateCode?: string;
  city?: string;
  zip?: string;
  address1?: string;
  couponCode?: string;
  userId?: string | null;
};

/**
 * Check if products can ship to the given country based on product availability settings.
 * Returns list of product IDs that cannot ship to the country.
 */
async function checkCountryAvailability(
  productIds: string[],
  countryCode: string,
): Promise<{
  unavailableProducts: string[];
  productCountryMap: Map<string, string[]>;
}> {
  if (productIds.length === 0) {
    return { unavailableProducts: [], productCountryMap: new Map() };
  }

  // Get all country restrictions for these products
  const restrictions = await db
    .select({
      productId: productAvailableCountryTable.productId,
      countryCode: productAvailableCountryTable.countryCode,
    })
    .from(productAvailableCountryTable)
    .where(inArray(productAvailableCountryTable.productId, productIds));

  // Build map of product -> allowed countries
  const productCountryMap = new Map<string, string[]>();
  for (const r of restrictions) {
    if (!productCountryMap.has(r.productId)) {
      productCountryMap.set(r.productId, []);
    }
    productCountryMap.get(r.productId)!.push(r.countryCode);
  }

  // Products with no restrictions can ship everywhere
  // Products with restrictions can only ship to listed countries
  const unavailableProducts: string[] = [];
  for (const productId of productIds) {
    const allowedCountries = productCountryMap.get(productId);
    if (allowedCountries && allowedCountries.length > 0) {
      // Product has country restrictions
      if (!allowedCountries.includes(countryCode)) {
        unavailableProducts.push(productId);
      }
    }
    // No restrictions = available everywhere
  }

  return { unavailableProducts, productCountryMap };
}

/**
 * Calculate Printful shipping rates for Printful items in the order.
 */
async function calculatePrintfulShipping(
  input: ExtendedShippingInput,
  printfulItems: Array<{ catalogVariantId: number; quantity: number }>,
): Promise<{ shippingCents: number; rate: PrintfulShippingRateOption | null }> {
  if (printfulItems.length === 0) {
    return { shippingCents: 0, rate: null };
  }

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    console.warn("Printful not configured, cannot calculate Printful shipping");
    return { shippingCents: 0, rate: null };
  }

  try {
    const orderItems: PrintfulShippingOrderItem[] = printfulItems.map(
      (item) => ({
        source: "catalog" as const,
        catalog_variant_id: item.catalogVariantId,
        quantity: item.quantity,
      }),
    );

    const response = await fetchShippingRates({
      recipient: {
        country_code: input.countryCode,
        state_code: input.stateCode,
        city: input.city,
        zip: input.zip,
        address1: input.address1 || "TBD", // Printful needs at least something
      },
      order_items: orderItems,
      currency: "USD",
    });

    if (response.data.length === 0) {
      console.warn("No Printful shipping rates available");
      return { shippingCents: 0, rate: null };
    }

    // Get STANDARD rate (cheapest/default), or first available
    const standardRate = response.data.find((r) => r.shipping === "STANDARD");
    const selectedRate = standardRate || response.data[0];

    const rateCents = Math.round(Number.parseFloat(selectedRate.rate) * 100);

    return {
      shippingCents: rateCents,
      rate: selectedRate,
    };
  } catch (error) {
    console.error("Failed to fetch Printful shipping rates:", error);
    return { shippingCents: 0, rate: null };
  }
}

/**
 * Main shipping calculation function.
 * Handles admin shipping options, Printful, and Printify shipping rates.
 * Also checks country-based availability restrictions.
 */
export async function runShippingCalculate(
  input: ExtendedShippingInput,
): Promise<ShippingResult> {
  const { countryCode, orderValueCents, items: rawItems } = input;
  const productIds = [...new Set(rawItems.map((i) => i.productId))];

  // If a valid free_shipping coupon is provided, return 0 shipping
  if (input.couponCode?.trim()) {
    const couponResult = await resolveCouponForCheckout(
      input.couponCode.trim(),
      orderValueCents,
      0,
      { userId: input.userId ?? undefined, productIds },
    );
    if (couponResult?.freeShipping) {
      return {
        ...ZERO_SHIPPING,
        freeShipping: true,
      };
    }
  }

  // Token-holder free shipping: if user is logged in, check automatic free_shipping coupons
  // that require a minimum token balance in a linked wallet
  if (input.userId) {
    const tokenHolderCoupons = await db
      .select({
        id: couponsTable.id,
        tokenHolderChain: couponsTable.tokenHolderChain,
        tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
        tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
      })
      .from(couponsTable)
      .where(
        and(
          eq(couponsTable.method, "automatic"),
          eq(couponsTable.discountKind, "free_shipping"),
          isNotNull(couponsTable.tokenHolderChain),
        ),
      );
    for (const c of tokenHolderCoupons) {
      const chain = c.tokenHolderChain as "solana" | "evm" | null;
      const tokenAddress = c.tokenHolderTokenAddress?.trim();
      const minBalance = c.tokenHolderMinBalance?.trim();
      if (
        (chain === "solana" || chain === "evm") &&
        tokenAddress &&
        minBalance
      ) {
        const meets = await userMeetsTokenHolderCondition(
          input.userId,
          chain,
          tokenAddress,
          minBalance,
        );
        if (meets) {
          return {
            ...ZERO_SHIPPING,
            freeShipping: true,
          };
        }
      }
    }
  }

  // Permanent exclusion: we do not ship to certain countries (all products).
  if (isShippingExcluded(countryCode)) {
    return {
      ...ZERO_SHIPPING,
      canShipToCountry: false,
      unavailableProducts: productIds,
    };
  }
  const variantIds = rawItems
    .map((i) => i.productVariantId)
    .filter((id): id is string => id != null);

  // Printify products in cart that have no variant in the item (e.g. simple/single-variant products)
  const printifyProductIdsWithoutVariant = [
    ...new Set(
      rawItems
        .filter((i) => i.productId && !i.productVariantId)
        .map((i) => i.productId!),
    ),
  ];

  let totalQuantity = 0;
  let totalWeightGrams = 0;
  let manualQuantity = 0;
  let manualWeightGrams = 0;
  let manualValueCents = 0;
  /** Per-brand totals for manual items (brandId -> valueCents, qty, weight) so we sum shipping per brand. */
  const perBrandManual = new Map<
    string | null,
    { valueCents: number; qty: number; weightGrams: number }
  >();
  function addToBrandBucket(
    brandId: string | null,
    valueCents: number,
    qty: number,
    weightGrams: number,
  ) {
    const cur = perBrandManual.get(brandId) ?? {
      valueCents: 0,
      qty: 0,
      weightGrams: 0,
    };
    perBrandManual.set(brandId, {
      valueCents: cur.valueCents + valueCents,
      qty: cur.qty + qty,
      weightGrams: cur.weightGrams + weightGrams,
    });
  }

  // Items for Printful shipping calculation
  const printfulItems: Array<{ catalogVariantId: number; quantity: number }> =
    [];

  // Items for Printify shipping calculation (requires blueprint/provider info)
  // For now, we'll use a simplified approach since we don't store blueprint_id in our schema
  // Printify shipping will be calculated via their catalog shipping profiles
  const printifyItems: Array<{
    blueprintId: number;
    printProviderId: number;
    variantId: number;
    quantity: number;
  }> = [];

  type ProductInfo = {
    id: string;
    brand: string | null;
    weightGrams: number | null;
    source: string;
    externalId: string | null;
    priceCents: number;
    printifyPrintProviderId: number | null;
  };
  let products: ProductInfo[] = [];
  let variants: Array<{
    id: string;
    productId: string;
    externalId: string | null;
    priceCents: number;
  }> = [];
  let allOptions: (typeof shippingOptionsTable.$inferSelect)[] = [];
  let brandNameToId = new Map<string, string>();
  let printifyDefaultVariantByProductId = new Map<string, string>();

  try {
    const [
      productsResult,
      variantsResult,
      defaultVariantsForPrintifyResult,
      optionsResult,
      brandsResult,
    ] = await Promise.all([
      productIds.length > 0
        ? db
            .select({
              id: productsTable.id,
              brand: productsTable.brand,
              weightGrams: productsTable.weightGrams,
              source: productsTable.source,
              externalId: productsTable.externalId,
              priceCents: productsTable.priceCents,
              printifyPrintProviderId: productsTable.printifyPrintProviderId,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : Promise.resolve([]),
      variantIds.length > 0
        ? db
            .select({
              id: productVariantsTable.id,
              productId: productVariantsTable.productId,
              externalId: productVariantsTable.externalId,
              priceCents: productVariantsTable.priceCents,
            })
            .from(productVariantsTable)
            .where(inArray(productVariantsTable.id, variantIds))
        : Promise.resolve([]),
      printifyProductIdsWithoutVariant.length > 0
        ? db
            .select({
              productId: productVariantsTable.productId,
              externalId: productVariantsTable.externalId,
            })
            .from(productVariantsTable)
            .where(
              inArray(
                productVariantsTable.productId,
                printifyProductIdsWithoutVariant,
              ),
            )
            .orderBy(
              asc(productVariantsTable.productId),
              asc(productVariantsTable.id),
            )
        : Promise.resolve([]),
      db
        .select()
        .from(shippingOptionsTable)
        .orderBy(asc(shippingOptionsTable.priority)),
      db.select({ id: brandTable.id, name: brandTable.name }).from(brandTable),
    ]);
    products = productsResult;
    variants = variantsResult;
    // First variant per product (for Printify items that have no variant in cart)
    printifyDefaultVariantByProductId = new Map<string, string>();
    if (defaultVariantsForPrintifyResult.length > 0) {
      for (const row of defaultVariantsForPrintifyResult) {
        if (row.productId && row.externalId && !printifyDefaultVariantByProductId.has(row.productId)) {
          printifyDefaultVariantByProductId.set(row.productId, row.externalId);
        }
      }
    }
    allOptions = optionsResult;
    brandNameToId = new Map<string, string>(
      (
        brandsResult as Array<{ id: string; name: string | null }>
      ).filter((b) => (b.name ?? "").trim().length > 0).map((b) => [
        (b.name ?? "").trim().toLowerCase(),
        b.id,
      ]),
    );
  } catch (dbErr) {
    console.warn("Shipping calculate: DB read failed", dbErr);
    return ZERO_SHIPPING;
  }

  // Check country availability for all products
  const { unavailableProducts } = await checkCountryAvailability(
    productIds,
    countryCode,
  );

  if (unavailableProducts.length > 0) {
    console.warn(
      `Products unavailable in ${countryCode}:`,
      unavailableProducts,
    );
    // Return with unavailable products list - let the frontend handle the display
    return {
      ...ZERO_SHIPPING,
      canShipToCountry: false,
      unavailableProducts,
    };
  }

  // Build lookup maps
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const variantExternalIdMap = new Map(
    variants.map((v) => [v.id, v.externalId]),
  );

  // Separate items by source (Printful, Printify, manual/other)
  for (const item of rawItems) {
    if (
      typeof item.productId !== "string" ||
      typeof item.quantity !== "number" ||
      item.quantity <= 0
    )
      continue;

    const product = productById.get(item.productId);
    if (!product) continue;

    const qty = item.quantity;
    const weight = (product.weightGrams ?? 0) * qty;

    // Get price - from variant if available, otherwise from product
    let itemPriceCents = product.priceCents;
    if (item.productVariantId) {
      const variant = variantById.get(item.productVariantId);
      if (variant) {
        itemPriceCents = variant.priceCents;
      }
    }
    const itemValueCents = itemPriceCents * qty;
    const brandId = product.brand?.trim()
      ? brandNameToId.get(product.brand.trim().toLowerCase()) ?? null
      : null;

    totalQuantity += qty;
    totalWeightGrams += weight;

    if (product.source === "printful") {
      // Get catalog_variant_id for Printful shipping
      let catalogVariantId: number | null = null;

      if (item.productVariantId) {
        const variantExternalId = variantExternalIdMap.get(
          item.productVariantId,
        );
        if (variantExternalId) {
          catalogVariantId = Number.parseInt(String(variantExternalId), 10);
        }
      }

      if (catalogVariantId && !isNaN(catalogVariantId)) {
        printfulItems.push({
          catalogVariantId,
          quantity: qty,
        });
      } else {
        // Fallback: treat as manual for shipping purposes
        console.warn(
          `Printful product ${item.productId} missing catalog_variant_id for shipping`,
        );
        manualQuantity += qty;
        manualWeightGrams += weight;
        manualValueCents += itemValueCents;
        addToBrandBucket(brandId, itemValueCents, qty, weight);
      }
    } else if (product.source === "printify") {
      // Printify shipping: need blueprint_id (externalId), print_provider_id (printifyPrintProviderId), variant_id (variant externalId)
      const blueprintId =
        product.externalId != null
          ? Number.parseInt(String(product.externalId), 10)
          : NaN;
      const printProviderId = product.printifyPrintProviderId ?? NaN;
      const hasBlueprintAndProvider =
        !isNaN(blueprintId) &&
        !isNaN(printProviderId) &&
        printProviderId > 0;

      let variantId: number | null = null;
      if (item.productVariantId != null) {
        const variantExternalId = variantExternalIdMap.get(
          item.productVariantId,
        );
        variantId =
          variantExternalId != null
            ? Number.parseInt(String(variantExternalId), 10)
            : null;
        if (variantId !== null && isNaN(variantId)) variantId = null;
      } else {
        // Single-variant or simple product: use first variant for this product
        const defaultExternalId =
          printifyDefaultVariantByProductId.get(item.productId);
        if (defaultExternalId != null) {
          const parsed = Number.parseInt(String(defaultExternalId), 10);
          if (!isNaN(parsed)) variantId = parsed;
        }
      }

      if (hasBlueprintAndProvider && variantId != null) {
        printifyItems.push({
          blueprintId,
          printProviderId,
          variantId,
          quantity: qty,
        });
      } else {
        manualQuantity += qty;
        manualWeightGrams += weight;
        manualValueCents += itemValueCents;
        addToBrandBucket(brandId, itemValueCents, qty, weight);
      }
    } else {
      // Manual or other source
      manualQuantity += qty;
      manualWeightGrams += weight;
      manualValueCents += itemValueCents;
      addToBrandBucket(brandId, itemValueCents, qty, weight);
    }
  }

  // Calculate Printful shipping (if any Printful items)
  const printfulResult = await calculatePrintfulShipping(input, printfulItems);

  // Calculate Printify shipping (if configured and items have blueprint + print provider IDs)
  // Products need externalId (blueprint_id) and printifyPrintProviderId; re-sync Printify products to backfill.
  let printifyShippingCents = 0;
  const printifyConfig = getPrintifyIfConfigured();

  if (printifyConfig && printifyItems.length > 0) {
    try {
      const printifyResult = await fetchPrintifyShippingRates(
        printifyItems,
        countryCode,
      );
      printifyShippingCents = printifyResult.shippingCents;

      if (!printifyResult.canShipToCountry) {
        // Printify can't ship to this country
        return {
          ...ZERO_SHIPPING,
          canShipToCountry: false,
          unavailableProducts: [], // Would need to map back to product IDs
        };
      }
    } catch (error) {
      console.error("Failed to calculate Printify shipping:", error);
      // Fall back to admin shipping for these items
    }
  }

  // Calculate admin shipping for manual items: sum per brand so multi-brand cart = sum of each brand's shipping
  let adminShippingCents = 0;
  const adminLabels: string[] = [];
  let adminFreeShipping = false;
  let adminShippingSpeed: "standard" | "express" = "standard";

  const hasPODItems = printfulItems.length > 0 || printifyItems.length > 0;

  if (manualQuantity > 0 || !hasPODItems) {
    // Per-brand: find best matching option for each brand's value/qty/weight and sum
    for (const [brandId, stats] of perBrandManual) {
      const applicable = allOptions
        .filter(
          (o) =>
            (o.brandId === brandId || o.brandId === null) &&
            (o.countryCode == null ||
              o.countryCode === "" ||
              o.countryCode === countryCode),
        )
        .sort((a, b) => {
          // Prefer brand-specific option over store-wide (brandId null)
          const aBrand = a.brandId != null ? 1 : 0;
          const bBrand = b.brandId != null ? 1 : 0;
          if (bBrand !== aBrand) return bBrand - aBrand;
          return (b.priority ?? 0) - (a.priority ?? 0);
        });

      for (const opt of applicable) {
        if (
          !matches(
            opt as ShippingOptionRow,
            stats.valueCents,
            stats.qty,
            stats.weightGrams,
          )
        )
          continue;

        if ((opt as { speed?: string | null }).speed === "express") {
          adminShippingSpeed = "express";
        }
        if (opt.type === "free") {
          adminLabels.push(opt.name);
          break;
        }
        if (opt.type === "flat" && opt.amountCents != null) {
          adminShippingCents += opt.amountCents;
          adminLabels.push(opt.name);
          break;
        }
        if (opt.type === "per_item" && opt.amountCents != null) {
          adminShippingCents += opt.amountCents * stats.qty;
          adminLabels.push(opt.name);
          break;
        }
        if (opt.type === "flat_plus_per_item" && opt.amountCents != null) {
          const additional = (opt.additionalItemCents ?? 0) * Math.max(0, stats.qty - 1);
          adminShippingCents += opt.amountCents + additional;
          adminLabels.push(opt.name);
          break;
        }
      }
    }
    adminFreeShipping =
      adminLabels.length > 0 &&
      perBrandManual.size > 0 &&
      adminShippingCents === 0;
  }

  const adminLabel =
    adminLabels.length > 0 ? adminLabels.join(" + ") : null;

  // Combine shipping costs
  const totalShippingCents =
    printfulResult.shippingCents + printifyShippingCents + adminShippingCents;

  // Determine label: strip third-party vendor names; use "Standard" or "Express" when not carrier-specific; aggregate -> "Standard" when multiple
  const labels: string[] = [];
  if (printfulResult.rate) {
    labels.push(
      normalizeThirdPartyShippingLabel(
        printfulResult.rate.shipping_method_name,
      ),
    );
  }
  if (printifyShippingCents > 0) {
    labels.push("Standard");
  }
  if (adminLabel) {
    labels.push(adminLabel);
  }
  const finalLabel =
    labels.length > 1
      ? "Standard"
      : labels.length > 0
        ? labels[0]
        : null;

  // Check for free shipping (only if entire order qualifies)
  const isFreeShipping =
    adminFreeShipping &&
    printfulResult.shippingCents === 0 &&
    printifyShippingCents === 0;

  return {
    shippingCents: isFreeShipping ? 0 : totalShippingCents,
    label: finalLabel,
    freeShipping: isFreeShipping,
    printfulShipping: printfulResult.rate,
    printfulShippingCents: printfulResult.shippingCents,
    printifyShippingCents,
    adminShippingCents: adminFreeShipping ? 0 : adminShippingCents,
    canShipToCountry: true,
    unavailableProducts: [],
    shippingSpeed: adminShippingSpeed,
  };
}

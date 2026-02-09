/**
 * Shared shipping calculation logic for POST /api/shipping/calculate.
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
  type PrintfulRecipient,
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

/**
 * Estimate sales tax / VAT for checkout display.
 * Printful and Printify do not provide pre-checkout tax APIs; this gives a best-effort
 * estimate by destination. Used for US state sales tax and EU/UK/NO VAT.
 */
function estimateTaxCents(
  subtotalCents: number,
  shippingCents: number,
  countryCode: string,
  stateCode?: string,
): { taxCents: number; note: string | null } {
  const country = countryCode.toUpperCase();
  // US: approximate state sales tax (rate × (subtotal + shipping) for most states)
  if (country === "US") {
    const state = (stateCode ?? "").trim().toUpperCase().slice(0, 2);
    // Approximate combined state + local rates (0 = no state sales tax)
    const US_STATE_TAX_RATE: Record<string, number> = {
      AL: 0.09, AZ: 0.08, AR: 0.095, CA: 0.0725, CO: 0.076, CT: 0.0635,
      DC: 0.06, FL: 0.06, GA: 0.07, HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07,
      IA: 0.06, KS: 0.065, KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06,
      MA: 0.0625, MI: 0.06, MN: 0.065, MS: 0.07, MO: 0.04225, NE: 0.055,
      NV: 0.0685, NJ: 0.06625, NM: 0.05125, NY: 0.08, NC: 0.0475, ND: 0.05,
      OH: 0.0575, OK: 0.045, PA: 0.06, RI: 0.07, SC: 0.06, SD: 0.045,
      TN: 0.07, TX: 0.0625, UT: 0.061, VT: 0.06, VA: 0.053, WA: 0.065,
      WV: 0.06, WI: 0.05, WY: 0.04,
    };
    const rate = state ? US_STATE_TAX_RATE[state] ?? 0.06 : 0.06;
    if (rate <= 0) return { taxCents: 0, note: null };
    const taxBase = subtotalCents + shippingCents;
    const taxCents = Math.round(taxBase * rate);
    return {
      taxCents,
      note: "Estimated sales tax. Final amount may vary by jurisdiction.",
    };
  }
  // EU, UK, Norway: VAT (approximate; actual rate varies by country)
  if (
    country === "GB" ||
    country === "NO" ||
    ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"].includes(country)
  ) {
    const vatRate = country === "GB" ? 0.20 : country === "NO" ? 0.25 : 0.20;
    const taxCents = Math.round((subtotalCents + shippingCents) * vatRate);
    return {
      taxCents,
      note: "Estimated VAT. Final amount may vary.",
    };
  }
  return { taxCents: 0, note: null };
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
  shippingSpeed: "standard" as "standard" | "express",
  taxCents: 0,
  taxNote: null as string | null,
  customsDutiesNote: null as string | null,
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
      taxCents: number;
      taxNote: string | null;
      customsDutiesNote: string | null;
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

/** US state/province full name -> 2-letter code for Printful (requires state_code for US, CA, AU). */
const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function normalizeStateCodeForPrintful(
  countryCode: string,
  stateCode: string | undefined,
): string | undefined {
  if (!stateCode?.trim()) return undefined;
  const s = stateCode.trim();
  if (s.length === 2 && /^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  if (countryCode === "US") {
    const code = US_STATE_NAME_TO_CODE[s.toLowerCase()];
    if (code) return code;
  }
  return s;
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
    console.warn(
      "[Printful shipping] PRINTFUL_API_TOKEN is not set; cannot calculate Printful shipping.",
    );
    return { shippingCents: 0, rate: null };
  }

  const storeIdRaw = process.env.PRINTFUL_STORE_ID?.trim();
  const storeId =
    storeIdRaw != null && storeIdRaw !== ""
      ? Number.parseInt(storeIdRaw, 10)
      : undefined;
  const storeIdFinal = Number.isNaN(storeId) ? undefined : storeId;

  try {
    const orderItems: PrintfulShippingOrderItem[] = printfulItems.map(
      (item) => ({
        source: "catalog" as const,
        catalog_variant_id: item.catalogVariantId,
        quantity: item.quantity,
      }),
    );

    const stateCode = normalizeStateCodeForPrintful(
      input.countryCode,
      input.stateCode,
    );
    // US, CA, AU require state_code for Printful to return rates
    const needsState = /^(US|CA|AU)$/i.test(input.countryCode);
    if (needsState && !stateCode?.trim()) {
      console.warn(
        "[Printful shipping] state_code required for US/CA/AU but missing or invalid; request may return no rates.",
        { countryCode: input.countryCode, stateCode: input.stateCode },
      );
    }

    const address1 = (input.address1 ?? "").trim() || undefined;
    const recipient: PrintfulRecipient = {
      country_code: input.countryCode,
      ...(stateCode && { state_code: stateCode }),
      ...(input.city?.trim() && { city: input.city.trim() }),
      ...(input.zip?.trim() && { zip: input.zip.trim() }),
      // Printful needs address1 for accurate rates; omit or use placeholder only when missing
      address1: address1 || "TBD",
    };

    const response = await fetchShippingRates(
      {
        recipient,
        order_items: orderItems,
        currency: "USD",
      },
      storeIdFinal,
    );

    if (response.data.length === 0) {
      console.warn(
        "[Printful shipping] No rates returned (check address: US/CA/AU require state_code; use full address when possible).",
        {
          country: input.countryCode,
          stateCode: stateCode ?? input.stateCode,
          hasAddress1: Boolean(address1),
        },
      );
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
    console.error(
      "[Printful shipping] Failed to fetch rates:",
      error instanceof Error ? error.message : error,
    );
    return { shippingCents: 0, rate: null };
  }
}

/**
 * Main shipping calculation function.
 * Handles admin shipping options, Printful, and Printify shipping rates.
 * Also checks country-based availability restrictions.
 */
/** Normalize cart items: cart line id is often "productId__variantId"; if productId looks like that, split so lookups succeed. */
function normalizeShippingItems(
  items: Array<{ productId: string; productVariantId?: string; quantity: number }>,
): Array<{ productId: string; productVariantId?: string; quantity: number }> {
  return items.map((i) => {
    const pid = i.productId?.trim();
    if (!pid) return i;
    const sep = pid.indexOf("__");
    if (sep === -1) return i;
    const productId = pid.slice(0, sep);
    const variantId = pid.slice(sep + 2);
    return {
      productId,
      productVariantId: i.productVariantId?.trim() || variantId || undefined,
      quantity: i.quantity,
    };
  });
}

export async function runShippingCalculate(
  input: ExtendedShippingInput,
): Promise<ShippingResult> {
  const { countryCode, orderValueCents, items: rawItems } = input;
  const items = normalizeShippingItems(rawItems);
  const productIds = [
    ...new Set(
      items.map((i) => i.productId).filter((id) => id != null && id.length > 0),
    ),
  ];

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
  const variantIds = items
    .map((i) => i.productVariantId)
    .filter((id): id is string => id != null && id.length > 0);

  // Products in cart that have no variant in the item (used for Printful + Printify fallback to first variant)
  const productIdsWithoutVariant = [
    ...new Set(
      items
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
  /** First variant externalId per product (for Printful/Printify when item has no variant or variant has no externalId). */
  let firstVariantExternalIdByProductId = new Map<string, string>();

  try {
    const [
      productsResult,
      variantsResult,
      defaultVariantsForPrintifyResult,
      firstVariantPerProductResult,
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
      productIdsWithoutVariant.length > 0
        ? db
            .select({
              productId: productVariantsTable.productId,
              externalId: productVariantsTable.externalId,
            })
            .from(productVariantsTable)
            .where(
              inArray(
                productVariantsTable.productId,
                productIdsWithoutVariant,
              ),
            )
            .orderBy(
              asc(productVariantsTable.productId),
              asc(productVariantsTable.id),
            )
        : Promise.resolve([]),
      productIds.length > 0
        ? db
            .select({
              productId: productVariantsTable.productId,
              externalId: productVariantsTable.externalId,
            })
            .from(productVariantsTable)
            .where(
              and(
                inArray(productVariantsTable.productId, productIds),
                isNotNull(productVariantsTable.externalId),
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
    // First variant externalId for every product in cart (fallback when variant lookup fails for Printful/Printify)
    firstVariantExternalIdByProductId = new Map<string, string>();
    if (firstVariantPerProductResult.length > 0) {
      for (const row of firstVariantPerProductResult) {
        if (row.productId && row.externalId && !firstVariantExternalIdByProductId.has(row.productId)) {
          firstVariantExternalIdByProductId.set(row.productId, row.externalId);
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

  /** Printful product IDs missing catalog_variant_id (log once per product per process to avoid spam). */
  const printfulMissingCatalogVariantIds = new Set<string>();

  // Separate items by source (Printful, Printify, manual/other)
  for (const item of items) {
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
      // Get catalog_variant_id for Printful shipping (required for rate calculation).
      // Variant externalId is set by Printful sync (printful-sync.ts); re-sync fixes missing IDs without any frontend change.
      let catalogVariantId: number | null = null;

      if (item.productVariantId) {
        const variantExternalId = variantExternalIdMap.get(
          item.productVariantId,
        );
        if (variantExternalId) {
          catalogVariantId = Number.parseInt(String(variantExternalId), 10);
        }
      }
      // When cart has no variant or variant has no externalId, use first variant for this product so we still get a rate
      if ((!catalogVariantId || isNaN(catalogVariantId)) && item.productId) {
        const firstVariantExternalId =
          printifyDefaultVariantByProductId.get(item.productId) ??
          firstVariantExternalIdByProductId.get(item.productId);
        if (firstVariantExternalId != null) {
          const parsed = Number.parseInt(String(firstVariantExternalId), 10);
          if (!isNaN(parsed)) catalogVariantId = parsed;
        }
      }

      if (catalogVariantId && !isNaN(catalogVariantId)) {
        printfulItems.push({
          catalogVariantId,
          quantity: qty,
        });
      } else {
        // Fallback: treat as manual for shipping purposes (re-sync product from Printful to backfill variant externalId)
        printfulMissingCatalogVariantIds.add(item.productId);
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

  const hasPrintfulProductsInCart = products.some((p) => p.source === "printful");
  if (printfulMissingCatalogVariantIds.size > 0) {
    const logged = (globalThis as unknown as { __printfulMissingLogged?: Set<string> }).__printfulMissingLogged ?? new Set<string>();
    (globalThis as unknown as { __printfulMissingLogged: Set<string> }).__printfulMissingLogged = logged;
    const toLog = [...printfulMissingCatalogVariantIds].filter((id) => {
      if (logged.has(id)) return false;
      logged.add(id);
      return true;
    });
    if (toLog.length > 0) {
      console.warn(
        `[Printful shipping] Product(s) missing catalog_variant_id (re-sync from Printful to fix): ${toLog.join(", ")}`,
      );
    }
  }
  if (hasPrintfulProductsInCart && printfulItems.length === 0) {
    console.warn(
      "[Printful shipping] Cart has Printful product(s) but no catalog variant IDs could be resolved. Re-sync products from Printful (admin sync or webhook) so variants have externalId.",
    );
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

        const isExpress = (opt as { speed?: string | null }).speed === "express";
        if (isExpress) {
          adminShippingSpeed = "express";
        }
        // For brand-specific options, show friendly name (e.g. "Standard Shipping") instead of internal name (e.g. "PacSafe US Free over $49")
        const displayLabel =
          opt.brandId != null
            ? isExpress
              ? "Express Shipping"
              : "Standard Shipping"
            : opt.name;
        if (opt.type === "free") {
          adminLabels.push(displayLabel);
          break;
        }
        if (opt.type === "flat" && opt.amountCents != null) {
          adminShippingCents += opt.amountCents;
          adminLabels.push(displayLabel);
          break;
        }
        if (opt.type === "per_item" && opt.amountCents != null) {
          adminShippingCents += opt.amountCents * stats.qty;
          adminLabels.push(displayLabel);
          break;
        }
        if (opt.type === "flat_plus_per_item" && opt.amountCents != null) {
          const additional = (opt.additionalItemCents ?? 0) * Math.max(0, stats.qty - 1);
          adminShippingCents += opt.amountCents + additional;
          adminLabels.push(displayLabel);
          break;
        }
      }
    }
    adminFreeShipping =
      adminLabels.length > 0 &&
      perBrandManual.size > 0 &&
      adminShippingCents === 0;
  }

  // Single label for UI: when all admin options use the same name (e.g. two brands both "Standard Shipping"), show it once
  const adminLabel =
    adminLabels.length > 0
      ? new Set(adminLabels).size === 1
        ? adminLabels[0]!
        : "Standard Shipping"
      : null;

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

  const finalShippingCents = isFreeShipping ? 0 : totalShippingCents;
  // Tax estimate only for Printful/Printify products (fulfillers may charge tax). Manual products: no tax in this flow.
  const hasPODProductsInCart = products.some(
    (p) => p.source === "printful" || p.source === "printify",
  );
  const { taxCents, note: taxNote } = hasPODProductsInCart
    ? estimateTaxCents(
        input.orderValueCents,
        finalShippingCents,
        input.countryCode,
        input.stateCode,
      )
    : { taxCents: 0, note: null as string | null };
  const customsDutiesNote = null; // Hidden from checkout per product request

  return {
    shippingCents: finalShippingCents,
    label: finalLabel,
    freeShipping: isFreeShipping,
    printfulShipping: printfulResult.rate,
    printfulShippingCents: printfulResult.shippingCents,
    printifyShippingCents,
    adminShippingCents: adminFreeShipping ? 0 : adminShippingCents,
    canShipToCountry: true,
    unavailableProducts: [],
    shippingSpeed: adminShippingSpeed,
    taxCents,
    taxNote,
    customsDutiesNote,
  };
}

/** Public API response: same shape without vendor-named fields. */
export function getPublicShippingResponse(result: ShippingResult) {
  return {
    shippingCents: result.shippingCents,
    label: result.label,
    freeShipping: result.freeShipping,
    canShipToCountry: result.canShipToCountry,
    unavailableProducts: result.unavailableProducts,
    shippingSpeed: result.shippingSpeed,
    taxCents: result.taxCents,
    taxNote: result.taxNote,
    customsDutiesNote: result.customsDutiesNote,
  };
}

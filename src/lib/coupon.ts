import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "~/db";
import {
  couponCategoryTable,
  couponProductTable,
  couponRedemptionTable,
  couponsTable,
} from "~/db/schema";
import { productCategoriesTable } from "~/db/schema";
import { userMeetsTokenHolderCondition } from "~/lib/token-holder-balance";

/** Input for automatic discount resolution (cart snapshot). */
export interface AutomaticCouponInput {
  /**
   * Individual cart items with prices. Required for per-product discounts
   * (discountKind "amount_off_products") so the discount is calculated only
   * on qualifying items rather than the full subtotal.
   */
  items?: CartLineItem[];
  /**
   * The selected payment method key (from PAYMENT_METHOD_DEFAULTS).
   * Used to match coupons with a `rulePaymentMethodKey` restriction.
   * e.g. "crypto_troll", "crypto_solana", "stripe", etc.
   * When undefined, coupons with a payment method restriction are skipped.
   */
  paymentMethodKey?: null | string;
  /** Total quantity of items in cart (sum of quantities). */
  productCount: number;
  productIds?: string[];
  shippingFeeCents: number;
  subtotalCents: number;
  userId?: null | string;
}

/** A cart line item with price info, used to compute per-product discounts. */
export interface CartLineItem {
  priceCents: number;
  productId: string;
  quantity: number;
}

export interface CouponCheckoutResult {
  code: string;
  couponId: string;
  /** Discount amount in cents (for order total). For free_shipping this is shippingCents. */
  discountCents: number;
  discountKind: string;
  discountType: string;
  discountValue: number;
  freeShipping: boolean;
  /** If set, this discount only applies when paying with this payment method key. */
  paymentMethodKey?: null | string;
  totalAfterDiscountCents: number;
}

/**
 * Find the best automatic discount that applies to the given cart.
 * Returns the coupon that gives the highest discountCents, or null if none apply.
 * Does not record redemption (that happens at order creation).
 */
export async function resolveAutomaticCouponForCheckout(
  input: AutomaticCouponInput,
): Promise<CouponCheckoutResult | null> {
  const now = new Date();
  const automaticCoupons = await db
    .select({
      appliesTo: couponsTable.appliesTo,
      code: couponsTable.code,
      dateEnd: couponsTable.dateEnd,
      dateStart: couponsTable.dateStart,
      discountKind: couponsTable.discountKind,
      discountType: couponsTable.discountType,
      discountValue: couponsTable.discountValue,
      id: couponsTable.id,
      maxUses: couponsTable.maxUses,
      maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
      maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
      ruleAppliesToEsim: couponsTable.ruleAppliesToEsim,
      ruleOrderTotalMaxCents: couponsTable.ruleOrderTotalMaxCents,
      ruleOrderTotalMinCents: couponsTable.ruleOrderTotalMinCents,
      rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
      ruleProductCountMax: couponsTable.ruleProductCountMax,
      ruleProductCountMin: couponsTable.ruleProductCountMin,
      ruleShippingMaxCents: couponsTable.ruleShippingMaxCents,
      ruleShippingMinCents: couponsTable.ruleShippingMinCents,
      ruleSubtotalMaxCents: couponsTable.ruleSubtotalMaxCents,
      ruleSubtotalMinCents: couponsTable.ruleSubtotalMinCents,
      tokenHolderChain: couponsTable.tokenHolderChain,
      tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
      tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
    })
    .from(couponsTable)
    .where(eq(couponsTable.method, "automatic"));

  const orderTotalCents = input.subtotalCents + input.shippingFeeCents;
  let best: CouponCheckoutResult | null = null;

  for (const coupon of automaticCoupons) {
    if (coupon.dateStart && now < coupon.dateStart) continue;
    if (coupon.dateEnd && now > coupon.dateEnd) continue;

    if (coupon.maxUses != null && coupon.maxUses > 0) {
      const [redemptionCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptionTable)
        .where(eq(couponRedemptionTable.couponId, coupon.id));
      if ((redemptionCount?.count ?? 0) >= coupon.maxUses) continue;
    }

    if (
      coupon.maxUsesPerCustomer != null &&
      coupon.maxUsesPerCustomer > 0 &&
      input.userId &&
      coupon.maxUsesPerCustomerType === "account"
    ) {
      const [userRedemptions] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptionTable)
        .where(
          and(
            eq(couponRedemptionTable.couponId, coupon.id),
            eq(couponRedemptionTable.userId, input.userId),
          ),
        );
      if ((userRedemptions?.count ?? 0) >= coupon.maxUsesPerCustomer) continue;
    }

    if (!meetsRuleset(coupon, input)) continue;

    // Payment method: only apply coupons that are explicitly set up for the selected method.
    // When the user has selected a payment method, do NOT apply coupons with no
    // rulePaymentMethodKey (e.g. "any method" coupons), so only admin-configured
    // payment-specific discounts apply.
    const requiredPaymentMethodKey = coupon.rulePaymentMethodKey?.trim();
    const selectedKey = input.paymentMethodKey?.trim();
    if (selectedKey) {
      if (
        !requiredPaymentMethodKey ||
        requiredPaymentMethodKey.toLowerCase() !== selectedKey.toLowerCase()
      ) {
        continue;
      }
    } else {
      if (requiredPaymentMethodKey) continue;
    }

    // Use productIds from input; when empty, derive from items so eSIM-only coupons still match
    const productIds =
      (input.productIds?.length ?? 0) > 0
        ? (input.productIds ?? [])
        : (input.items?.map((i) => i.productId).filter(Boolean) ?? []);
    const hasEsimRule = Number(coupon.ruleAppliesToEsim) === 1;
    const cartHasEsim =
      productIds.some((id) => String(id).startsWith("esim_")) ||
      (input.items?.some((i) => String(i.productId).startsWith("esim_")) ??
        false);
    // Rule: cart must contain at least one of these products and/or at least one product from these categories (if any are set)
    // Also compute the qualifying subtotal for per-product discounts (amount_off_products).
    let qualifyingSubtotalCents: number | undefined;
    if (productIds.length > 0) {
      const [allowedProductIds, couponCategoryIds] = await Promise.all([
        db
          .select({ productId: couponProductTable.productId })
          .from(couponProductTable)
          .where(eq(couponProductTable.couponId, coupon.id))
          .then((rows) => rows.map((r) => r.productId)),
        db
          .select({ categoryId: couponCategoryTable.categoryId })
          .from(couponCategoryTable)
          .where(eq(couponCategoryTable.couponId, coupon.id))
          .then((rows) => rows.map((r) => r.categoryId)),
      ]);
      const hasProductRule = allowedProductIds.length > 0;
      const hasCategoryRule = couponCategoryIds.length > 0;
      if (hasProductRule || hasCategoryRule || hasEsimRule) {
        const cartHasAllowedProduct =
          hasProductRule &&
          productIds.some((id) => allowedProductIds.includes(id));
        // For per-product discounts, also find which specific product IDs match by category
        let matchingCategoryProductIds: string[] = [];
        let cartHasProductFromCategory = false;
        if (hasCategoryRule) {
          const categoryMatches = await db
            .select({ productId: productCategoriesTable.productId })
            .from(productCategoriesTable)
            .where(
              and(
                inArray(productCategoriesTable.categoryId, couponCategoryIds),
                inArray(productCategoriesTable.productId, productIds),
              ),
            );
          matchingCategoryProductIds = categoryMatches.map((r) => r.productId);
          cartHasProductFromCategory = matchingCategoryProductIds.length > 0;
        }
        // Pass if either rule is satisfied (OR when both are set)
        if (
          !cartHasAllowedProduct &&
          !cartHasProductFromCategory &&
          !(hasEsimRule && cartHasEsim)
        )
          continue;

        // For amount_off_products: compute qualifying subtotal from matching items only
        if (
          (coupon.discountKind === "amount_off_products" ||
            coupon.appliesTo === "product") &&
          input.items &&
          input.items.length > 0
        ) {
          const qualifyingProductIdSet = new Set<string>([
            ...(hasProductRule ? allowedProductIds : []),
            ...matchingCategoryProductIds,
            ...(hasEsimRule
              ? productIds.filter((id) => id.startsWith("esim_"))
              : []),
          ]);
          qualifyingSubtotalCents = input.items
            .filter((item) => qualifyingProductIdSet.has(item.productId))
            .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
        }
      }
    }
    if (hasEsimRule && !cartHasEsim) continue;

    // Fallback: for eSIM-only coupons, ensure we have qualifying subtotal from eSIM items when it wasn't set above
    if (
      hasEsimRule &&
      qualifyingSubtotalCents === undefined &&
      input.items &&
      input.items.length > 0 &&
      (coupon.discountKind === "amount_off_products" ||
        coupon.appliesTo === "product")
    ) {
      const esimProductIds = productIds.filter((id) => id.startsWith("esim_"));
      if (esimProductIds.length > 0) {
        const esimSet = new Set(esimProductIds);
        qualifyingSubtotalCents = input.items
          .filter((item) => esimSet.has(item.productId))
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      }
    }

    const tokenChain = coupon.tokenHolderChain?.trim();
    const tokenAddress = coupon.tokenHolderTokenAddress?.trim();
    const tokenMinBalance = coupon.tokenHolderMinBalance?.trim();
    if (tokenChain && tokenAddress && tokenMinBalance) {
      if (!input.userId) continue;
      const chain = tokenChain.toLowerCase() as "evm" | "solana";
      if (chain === "solana" || chain === "evm") {
        const meets = await userMeetsTokenHolderCondition(
          input.userId,
          chain,
          tokenAddress,
          tokenMinBalance,
        );
        if (!meets) continue;
      }
    }

    const { discountCents, freeShipping } = computeDiscountFromCoupon(
      coupon,
      input.subtotalCents,
      input.shippingFeeCents,
      qualifyingSubtotalCents,
    );
    const totalAfterDiscountCents = Math.max(
      0,
      orderTotalCents - discountCents,
    );
    const candidate: CouponCheckoutResult = {
      code: coupon.code,
      couponId: coupon.id,
      discountCents,
      discountKind: coupon.discountKind ?? "amount_off_order",
      discountType: coupon.discountType ?? "percent",
      discountValue: coupon.discountValue ?? 0,
      freeShipping,
      paymentMethodKey: coupon.rulePaymentMethodKey ?? null,
      totalAfterDiscountCents,
    };
    if (!best || candidate.discountCents > best.discountCents) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Validate and resolve a coupon code for checkout.
 * Returns discount info and computed discountCents, or null if invalid.
 * Does not record redemption (that happens at order creation).
 */
export async function resolveCouponForCheckout(
  code: null | string | undefined,
  subtotalCents: number,
  shippingFeeCents: number,
  options: {
    items?: CartLineItem[];
    paymentMethodKey?: null | string;
    productIds?: string[];
    userId?: null | string;
  } = {},
): Promise<CouponCheckoutResult | null> {
  const raw = code?.trim();
  if (!raw || raw.length === 0) return null;

  const normalizedCode = raw.toUpperCase();
  const now = new Date();

  const [coupon] = await db
    .select({
      appliesTo: couponsTable.appliesTo,
      code: couponsTable.code,
      dateEnd: couponsTable.dateEnd,
      dateStart: couponsTable.dateStart,
      discountKind: couponsTable.discountKind,
      discountType: couponsTable.discountType,
      discountValue: couponsTable.discountValue,
      id: couponsTable.id,
      maxUses: couponsTable.maxUses,
      maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
      maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
      method: couponsTable.method,
      ruleAppliesToEsim: couponsTable.ruleAppliesToEsim,
      rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
      tokenHolderChain: couponsTable.tokenHolderChain,
      tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
      tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
    })
    .from(couponsTable)
    .where(eq(couponsTable.code, normalizedCode))
    .limit(1);

  // Code-based coupons must have method "code"; automatic coupons (AUTO-*) are
  // also resolved here when a coupon code is forwarded from the automatic flow
  if (!coupon || (coupon.method !== "code" && coupon.method !== "automatic"))
    return null;

  if (coupon.dateStart && now < coupon.dateStart) return null;
  if (coupon.dateEnd && now > coupon.dateEnd) return null;

  // NOTE: This check is advisory only — the actual atomic guard is enforced at
  // insert time in postOrderBookkeeping using a conditional INSERT ... WHERE
  // to prevent TOCTOU races under concurrent requests.
  if (coupon.maxUses != null && coupon.maxUses > 0) {
    const [redemptionCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponRedemptionTable)
      .where(eq(couponRedemptionTable.couponId, coupon.id));
    if ((redemptionCount?.count ?? 0) >= coupon.maxUses) return null;
  }

  if (
    coupon.maxUsesPerCustomer != null &&
    coupon.maxUsesPerCustomer > 0 &&
    options.userId &&
    coupon.maxUsesPerCustomerType === "account"
  ) {
    const [userRedemptions] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponRedemptionTable)
      .where(
        and(
          eq(couponRedemptionTable.couponId, coupon.id),
          eq(couponRedemptionTable.userId, options.userId),
        ),
      );
    if ((userRedemptions?.count ?? 0) >= coupon.maxUsesPerCustomer) return null;
  }

  const productIds = options.productIds ?? [];
  const hasEsimRule = Number(coupon.ruleAppliesToEsim) === 1;
  const cartHasEsim =
    productIds.some((id) => String(id).startsWith("esim_")) ||
    (options.items?.some((i) => String(i.productId).startsWith("esim_")) ??
      false);
  let qualifyingSubtotalCents: number | undefined;
  if (productIds.length > 0) {
    const [allowedProductIds, couponCategoryIds] = await Promise.all([
      db
        .select({ productId: couponProductTable.productId })
        .from(couponProductTable)
        .where(eq(couponProductTable.couponId, coupon.id))
        .then((rows) => rows.map((r) => r.productId)),
      db
        .select({ categoryId: couponCategoryTable.categoryId })
        .from(couponCategoryTable)
        .where(eq(couponCategoryTable.couponId, coupon.id))
        .then((rows) => rows.map((r) => r.categoryId)),
    ]);
    const hasProductRule = allowedProductIds.length > 0;
    const hasCategoryRule = couponCategoryIds.length > 0;
    if (hasProductRule || hasCategoryRule || hasEsimRule) {
      const cartHasAllowedProduct =
        hasProductRule &&
        productIds.some((id) => allowedProductIds.includes(id));
      let matchingCategoryProductIds: string[] = [];
      let cartHasProductFromCategory = false;
      if (hasCategoryRule) {
        const categoryMatches = await db
          .select({ productId: productCategoriesTable.productId })
          .from(productCategoriesTable)
          .where(
            and(
              inArray(productCategoriesTable.categoryId, couponCategoryIds),
              inArray(productCategoriesTable.productId, productIds),
            ),
          );
        matchingCategoryProductIds = categoryMatches.map((r) => r.productId);
        cartHasProductFromCategory = matchingCategoryProductIds.length > 0;
      }
      if (
        !cartHasAllowedProduct &&
        !cartHasProductFromCategory &&
        !(hasEsimRule && cartHasEsim)
      )
        return null;

      // For amount_off_products: compute qualifying subtotal from matching items only
      if (
        (coupon.discountKind === "amount_off_products" ||
          coupon.appliesTo === "product") &&
        options.items &&
        options.items.length > 0
      ) {
        const qualifyingProductIdSet = new Set<string>([
          ...(hasProductRule ? allowedProductIds : []),
          ...matchingCategoryProductIds,
          ...(hasEsimRule
            ? productIds.filter((id) => id.startsWith("esim_"))
            : []),
        ]);
        qualifyingSubtotalCents = options.items
          .filter((item) => qualifyingProductIdSet.has(item.productId))
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      }
    }
  }
  if (hasEsimRule && !cartHasEsim) return null;

  // Token-holder restriction: coupon applies only if user holds required token balance (linked wallet).
  const tokenChain = coupon.tokenHolderChain?.trim();
  const tokenAddress = coupon.tokenHolderTokenAddress?.trim();
  const tokenMinBalance = coupon.tokenHolderMinBalance?.trim();
  if (tokenChain && tokenAddress && tokenMinBalance) {
    if (!options.userId) return null; // Guest cannot use token-holder-only coupon
    const chain = tokenChain.toLowerCase() as "evm" | "solana";
    if (chain === "solana" || chain === "evm") {
      const meets = await userMeetsTokenHolderCondition(
        options.userId,
        chain,
        tokenAddress,
        tokenMinBalance,
      );
      if (!meets) return null;
    }
  }

  // Payment method restriction: coupon applies only when paying with a specific method.
  const couponPaymentMethodKey = coupon.rulePaymentMethodKey?.trim();
  if (couponPaymentMethodKey) {
    const selectedKey = options.paymentMethodKey?.trim();
    if (
      !selectedKey ||
      selectedKey.toLowerCase() !== couponPaymentMethodKey.toLowerCase()
    )
      return null;
  }

  const { discountCents, freeShipping } = computeDiscountFromCoupon(
    coupon,
    subtotalCents,
    shippingFeeCents,
    qualifyingSubtotalCents,
  );

  const totalBeforeDiscount = subtotalCents + shippingFeeCents;
  const totalAfterDiscountCents = Math.max(
    0,
    totalBeforeDiscount - discountCents,
  );

  return {
    code: coupon.code,
    couponId: coupon.id,
    discountCents,
    discountKind: coupon.discountKind ?? "amount_off_order",
    discountType: coupon.discountType ?? "percent",
    discountValue: coupon.discountValue ?? 0,
    freeShipping,
    totalAfterDiscountCents,
  };
}

function computeDiscountFromCoupon(
  coupon: {
    discountKind: null | string;
    discountType: null | string;
    discountValue: number;
  },
  subtotalCents: number,
  shippingFeeCents: number,
  /**
   * For "amount_off_products": the subtotal of only the qualifying items.
   * When provided, the discount is applied to this amount instead of the
   * full subtotal. When undefined, falls back to full subtotal.
   */
  qualifyingSubtotalCents?: number,
): { discountCents: number; freeShipping: boolean } {
  const discountKind = (coupon.discountKind ?? "amount_off_order").toLowerCase();
  const discountType = (coupon.discountType ?? "percent").toLowerCase();
  const discountValue = Number(coupon.discountValue) || 0;
  const freeShipping = discountKind === "free_shipping";
  let discountCents = 0;
  if (freeShipping) {
    discountCents = shippingFeeCents;
  } else if (discountKind === "amount_off_order") {
    const totalCents = subtotalCents + shippingFeeCents;
    if (discountType === "percent" || discountType === "percentage") {
      discountCents = Math.round(
        totalCents * (Math.min(100, Math.max(0, discountValue)) / 100),
      );
    } else {
      discountCents = Math.min(Math.round(discountValue), totalCents);
    }
  } else if (discountKind === "amount_off_products") {
    // Use qualifying product subtotal when available, otherwise full subtotal
    const basis = qualifyingSubtotalCents ?? subtotalCents;
    if (discountType === "percent" || discountType === "percentage") {
      discountCents = Math.round(
        basis * (Math.min(100, Math.max(0, discountValue)) / 100),
      );
    } else {
      discountCents = Math.min(Math.round(discountValue), basis);
    }
  }
  return { discountCents, freeShipping };
}

function meetsRuleset(
  coupon: {
    ruleOrderTotalMaxCents: null | number;
    ruleOrderTotalMinCents: null | number;
    ruleProductCountMax: null | number;
    ruleProductCountMin: null | number;
    ruleShippingMaxCents: null | number;
    ruleShippingMinCents: null | number;
    ruleSubtotalMaxCents: null | number;
    ruleSubtotalMinCents: null | number;
  },
  input: AutomaticCouponInput,
): boolean {
  const orderTotalCents = input.subtotalCents + input.shippingFeeCents;
  if (
    coupon.ruleSubtotalMinCents != null &&
    input.subtotalCents < coupon.ruleSubtotalMinCents
  )
    return false;
  if (
    coupon.ruleSubtotalMaxCents != null &&
    input.subtotalCents > coupon.ruleSubtotalMaxCents
  )
    return false;
  if (
    coupon.ruleShippingMinCents != null &&
    input.shippingFeeCents < coupon.ruleShippingMinCents
  )
    return false;
  if (
    coupon.ruleShippingMaxCents != null &&
    input.shippingFeeCents > coupon.ruleShippingMaxCents
  )
    return false;
  if (
    coupon.ruleProductCountMin != null &&
    input.productCount < coupon.ruleProductCountMin
  )
    return false;
  if (
    coupon.ruleProductCountMax != null &&
    input.productCount > coupon.ruleProductCountMax
  )
    return false;
  if (
    coupon.ruleOrderTotalMinCents != null &&
    orderTotalCents < coupon.ruleOrderTotalMinCents
  )
    return false;
  if (
    coupon.ruleOrderTotalMaxCents != null &&
    orderTotalCents > coupon.ruleOrderTotalMaxCents
  )
    return false;
  return true;
}

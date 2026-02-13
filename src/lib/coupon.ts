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

export type CouponCheckoutResult = {
  couponId: string;
  code: string;
  discountKind: string;
  discountType: string;
  discountValue: number;
  /** Discount amount in cents (for order total). For free_shipping this is shippingCents. */
  discountCents: number;
  freeShipping: boolean;
  totalAfterDiscountCents: number;
  /** If set, this discount only applies when paying with this payment method key. */
  paymentMethodKey?: string | null;
};

/**
 * Validate and resolve a coupon code for checkout.
 * Returns discount info and computed discountCents, or null if invalid.
 * Does not record redemption (that happens at order creation).
 */
export async function resolveCouponForCheckout(
  code: string | undefined | null,
  subtotalCents: number,
  shippingFeeCents: number,
  options: {
    userId?: string | null;
    productIds?: string[];
    paymentMethodKey?: string | null;
  } = {},
): Promise<CouponCheckoutResult | null> {
  const raw = code?.trim();
  if (!raw || raw.length === 0) return null;

  const normalizedCode = raw.toUpperCase();
  const now = new Date();

  const [coupon] = await db
    .select({
      id: couponsTable.id,
      code: couponsTable.code,
      method: couponsTable.method,
      dateStart: couponsTable.dateStart,
      dateEnd: couponsTable.dateEnd,
      discountKind: couponsTable.discountKind,
      discountType: couponsTable.discountType,
      discountValue: couponsTable.discountValue,
      appliesTo: couponsTable.appliesTo,
      maxUses: couponsTable.maxUses,
      maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
      maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
      tokenHolderChain: couponsTable.tokenHolderChain,
      tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
      tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
      rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
    })
    .from(couponsTable)
    .where(eq(couponsTable.code, normalizedCode))
    .limit(1);

  if (!coupon || coupon.method !== "code") return null;

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
  if (productIds.length > 0) {
    const allowedProductIds = (
      await db
        .select({ productId: couponProductTable.productId })
        .from(couponProductTable)
        .where(eq(couponProductTable.couponId, coupon.id))
    ).map((r) => r.productId);
    if (
      allowedProductIds.length > 0 &&
      !productIds.some((id) => allowedProductIds.includes(id))
    ) {
      return null;
    }
  }

  // Token-holder restriction: coupon applies only if user holds required token balance (linked wallet).
  const tokenChain = coupon.tokenHolderChain?.trim();
  const tokenAddress = coupon.tokenHolderTokenAddress?.trim();
  const tokenMinBalance = coupon.tokenHolderMinBalance?.trim();
  if (tokenChain && tokenAddress && tokenMinBalance) {
    if (!options.userId) return null; // Guest cannot use token-holder-only coupon
    const chain = tokenChain.toLowerCase() as "solana" | "evm";
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
    if (!selectedKey || selectedKey !== couponPaymentMethodKey) return null;
  }

  const discountKind = coupon.discountKind ?? "amount_off_order";
  const discountType = coupon.discountType ?? "percent";
  const discountValue = coupon.discountValue ?? 0;

  let discountCents = 0;
  const freeShipping = discountKind === "free_shipping";

  if (freeShipping) {
    discountCents = shippingFeeCents;
  } else if (discountKind === "amount_off_order") {
    const totalCents = subtotalCents + shippingFeeCents;
    if (discountType === "percent") {
      discountCents = Math.round(
        totalCents * (Math.min(100, discountValue) / 100),
      );
    } else {
      discountCents = Math.min(discountValue, totalCents);
    }
  } else if (discountKind === "amount_off_products") {
    if (discountType === "percent") {
      discountCents = Math.round(
        subtotalCents * (Math.min(100, discountValue) / 100),
      );
    } else {
      discountCents = Math.min(discountValue, subtotalCents);
    }
  }

  const totalBeforeDiscount = subtotalCents + shippingFeeCents;
  const totalAfterDiscountCents = Math.max(
    0,
    totalBeforeDiscount - discountCents,
  );

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountKind,
    discountType,
    discountValue,
    discountCents,
    freeShipping,
    totalAfterDiscountCents,
  };
}

/** Input for automatic discount resolution (cart snapshot). */
export type AutomaticCouponInput = {
  subtotalCents: number;
  shippingFeeCents: number;
  /** Total quantity of items in cart (sum of quantities). */
  productCount: number;
  productIds?: string[];
  userId?: string | null;
  /**
   * The selected payment method key (from PAYMENT_METHOD_DEFAULTS).
   * Used to match coupons with a `rulePaymentMethodKey` restriction.
   * e.g. "crypto_troll", "crypto_solana", "stripe", etc.
   * When undefined, coupons with a payment method restriction are skipped.
   */
  paymentMethodKey?: string | null;
};

function meetsRuleset(
  coupon: {
    ruleSubtotalMinCents: number | null;
    ruleSubtotalMaxCents: number | null;
    ruleShippingMinCents: number | null;
    ruleShippingMaxCents: number | null;
    ruleProductCountMin: number | null;
    ruleProductCountMax: number | null;
    ruleOrderTotalMinCents: number | null;
    ruleOrderTotalMaxCents: number | null;
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

function computeDiscountFromCoupon(
  coupon: {
    discountKind: string | null;
    discountType: string | null;
    discountValue: number;
  },
  subtotalCents: number,
  shippingFeeCents: number,
): { discountCents: number; freeShipping: boolean } {
  const discountKind = coupon.discountKind ?? "amount_off_order";
  const discountType = coupon.discountType ?? "percent";
  const discountValue = coupon.discountValue ?? 0;
  const freeShipping = discountKind === "free_shipping";
  let discountCents = 0;
  if (freeShipping) {
    discountCents = shippingFeeCents;
  } else if (discountKind === "amount_off_order") {
    const totalCents = subtotalCents + shippingFeeCents;
    if (discountType === "percent") {
      discountCents = Math.round(
        totalCents * (Math.min(100, discountValue) / 100),
      );
    } else {
      discountCents = Math.min(discountValue, totalCents);
    }
  } else if (discountKind === "amount_off_products") {
    if (discountType === "percent") {
      discountCents = Math.round(
        subtotalCents * (Math.min(100, discountValue) / 100),
      );
    } else {
      discountCents = Math.min(discountValue, subtotalCents);
    }
  }
  return { discountCents, freeShipping };
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
      id: couponsTable.id,
      code: couponsTable.code,
      dateStart: couponsTable.dateStart,
      dateEnd: couponsTable.dateEnd,
      discountKind: couponsTable.discountKind,
      discountType: couponsTable.discountType,
      discountValue: couponsTable.discountValue,
      maxUses: couponsTable.maxUses,
      maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
      maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
      tokenHolderChain: couponsTable.tokenHolderChain,
      tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
      tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
      rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
      ruleSubtotalMinCents: couponsTable.ruleSubtotalMinCents,
      ruleSubtotalMaxCents: couponsTable.ruleSubtotalMaxCents,
      ruleShippingMinCents: couponsTable.ruleShippingMinCents,
      ruleShippingMaxCents: couponsTable.ruleShippingMaxCents,
      ruleProductCountMin: couponsTable.ruleProductCountMin,
      ruleProductCountMax: couponsTable.ruleProductCountMax,
      ruleOrderTotalMinCents: couponsTable.ruleOrderTotalMinCents,
      ruleOrderTotalMaxCents: couponsTable.ruleOrderTotalMaxCents,
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

    // Payment method restriction: if the coupon requires a specific payment method,
    // skip it when no payment method is selected or when it doesn't match.
    const requiredPaymentMethodKey = coupon.rulePaymentMethodKey?.trim();
    if (requiredPaymentMethodKey) {
      const selectedKey = input.paymentMethodKey?.trim();
      if (!selectedKey || selectedKey !== requiredPaymentMethodKey) continue;
    }

    const productIds = input.productIds ?? [];
    // Rule: cart must contain at least one of these products and/or at least one product from these categories (if any are set)
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
      if (hasProductRule || hasCategoryRule) {
        const cartHasAllowedProduct =
          hasProductRule &&
          productIds.some((id) => allowedProductIds.includes(id));
        let cartHasProductFromCategory = false;
        if (hasCategoryRule) {
          const [match] = await db
            .select({ productId: productCategoriesTable.productId })
            .from(productCategoriesTable)
            .where(
              and(
                inArray(productCategoriesTable.categoryId, couponCategoryIds),
                inArray(productCategoriesTable.productId, productIds),
              ),
            )
            .limit(1);
          cartHasProductFromCategory = Boolean(match);
        }
        // Pass if either rule is satisfied (OR when both are set)
        if (!cartHasAllowedProduct && !cartHasProductFromCategory) continue;
      }
    }

    const tokenChain = coupon.tokenHolderChain?.trim();
    const tokenAddress = coupon.tokenHolderTokenAddress?.trim();
    const tokenMinBalance = coupon.tokenHolderMinBalance?.trim();
    if (tokenChain && tokenAddress && tokenMinBalance) {
      if (!input.userId) continue;
      const chain = tokenChain.toLowerCase() as "solana" | "evm";
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
    );
    const totalAfterDiscountCents = Math.max(
      0,
      orderTotalCents - discountCents,
    );
    const candidate: CouponCheckoutResult = {
      couponId: coupon.id,
      code: coupon.code,
      discountKind: coupon.discountKind ?? "amount_off_order",
      discountType: coupon.discountType ?? "percent",
      discountValue: coupon.discountValue ?? 0,
      discountCents,
      freeShipping,
      totalAfterDiscountCents,
      paymentMethodKey: coupon.rulePaymentMethodKey ?? null,
    };
    if (
      !best ||
      candidate.discountCents > best.discountCents
    ) {
      best = candidate;
    }
  }

  return best;
}

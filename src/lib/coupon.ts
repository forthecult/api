import { and, eq, sql } from "drizzle-orm";

import { db } from "~/db";
import {
  couponCategoryTable,
  couponProductTable,
  couponRedemptionTable,
  couponsTable,
} from "~/db/schema";
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
    })
    .from(couponsTable)
    .where(eq(couponsTable.code, normalizedCode))
    .limit(1);

  if (!coupon || coupon.method !== "code") return null;

  if (coupon.dateStart && now < coupon.dateStart) return null;
  if (coupon.dateEnd && now > coupon.dateEnd) return null;

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

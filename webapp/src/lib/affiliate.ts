import { eq } from "drizzle-orm";

import { db } from "~/db";
import { affiliateTable } from "~/db/schema";

export interface AffiliateOrderResult {
  affiliateCode: string;
  affiliateId: string;
  commissionCents: number;
  discountCents: number;
}

/**
 * Resolve affiliate by code (must be approved). Compute customer discount and commission.
 * Commission is based on order total after discount.
 */
export async function resolveAffiliateForOrder(
  code: null | string | undefined,
  subtotalCents: number,
  shippingFeeCents: number,
): Promise<null | {
  affiliate: AffiliateOrderResult;
  discountCents: number;
  totalAfterDiscountCents: number;
}> {
  const raw = code?.trim();
  if (!raw || raw.length === 0) return null;

  const normalizedCode = raw.toUpperCase();

  const [affiliate] = await db
    .select({
      code: affiliateTable.code,
      commissionType: affiliateTable.commissionType,
      commissionValue: affiliateTable.commissionValue,
      customerDiscountType: affiliateTable.customerDiscountType,
      customerDiscountValue: affiliateTable.customerDiscountValue,
      id: affiliateTable.id,
      status: affiliateTable.status,
    })
    .from(affiliateTable)
    .where(eq(affiliateTable.code, normalizedCode))
    .limit(1);

  if (!affiliate || affiliate.status !== "approved") return null;

  const totalBeforeDiscountCents = subtotalCents + shippingFeeCents;
  let discountCents = 0;

  if (
    affiliate.customerDiscountType &&
    affiliate.customerDiscountValue != null &&
    affiliate.customerDiscountValue > 0
  ) {
    if (affiliate.customerDiscountType === "percent") {
      discountCents = Math.round(
        totalBeforeDiscountCents *
          (Math.min(100, affiliate.customerDiscountValue) / 100),
      );
    } else {
      discountCents = Math.min(
        affiliate.customerDiscountValue,
        totalBeforeDiscountCents,
      );
    }
  }

  const totalAfterDiscountCents = Math.max(
    0,
    totalBeforeDiscountCents - discountCents,
  );

  let commissionCents: number;
  if (affiliate.commissionType === "percent") {
    commissionCents = Math.round(
      totalAfterDiscountCents *
        (Math.min(100, affiliate.commissionValue) / 100),
    );
  } else {
    commissionCents = Math.min(
      affiliate.commissionValue,
      totalAfterDiscountCents,
    );
  }

  return {
    affiliate: {
      affiliateCode: affiliate.code,
      affiliateId: affiliate.id,
      commissionCents,
      discountCents,
    },
    discountCents,
    totalAfterDiscountCents,
  };
}

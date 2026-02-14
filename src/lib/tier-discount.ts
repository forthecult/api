/**
 * Resolve stacked CULT member tier discounts for checkout.
 * Multiple discounts per tier apply additively (e.g. 20% off shipping + 15% off eSIMs).
 */

import { and, eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import { memberTierDiscountTable } from "~/db/schema";
import { productCategoriesTable } from "~/db/schema";

export type TierDiscountItem = {
  productId: string;
  priceCents: number;
  quantity: number;
};

export type ResolvedTierDiscount = {
  id: string;
  label: string | null;
  scope: string;
  discountCents: number;
};

export type ResolveTierDiscountsResult = {
  discounts: ResolvedTierDiscount[];
  totalCents: number;
};

/**
 * Resolve all tier-based discounts for a given member tier and cart.
 * Discounts stack (shipping + order + category + product scopes applied independently).
 */
export async function resolveTierDiscountsForCheckout(
  memberTier: number,
  params: {
    subtotalCents: number;
    shippingFeeCents: number;
    items: TierDiscountItem[];
  },
): Promise<ResolveTierDiscountsResult> {
  const { subtotalCents, shippingFeeCents, items } = params;

  const rows = await db
    .select()
    .from(memberTierDiscountTable)
    .where(eq(memberTierDiscountTable.memberTier, memberTier));

  if (rows.length === 0) {
    return { discounts: [], totalCents: 0 };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  let productCategoryMap = new Map<string, string[]>();
  if (productIds.length > 0) {
    const links = await db
      .select({
        productId: productCategoriesTable.productId,
        categoryId: productCategoriesTable.categoryId,
      })
      .from(productCategoriesTable)
      .where(inArray(productCategoriesTable.productId, productIds));
    for (const l of links) {
      const list = productCategoryMap.get(l.productId) ?? [];
      list.push(l.categoryId);
      productCategoryMap.set(l.productId, list);
    }
  }

  const discounts: ResolvedTierDiscount[] = [];
  let totalCents = 0;

  for (const row of rows) {
    const scope = row.scope ?? "order";
    const discountType = row.discountType ?? "percent";
    const discountValue = row.discountValue ?? 0;

    let basisCents = 0;

    if (scope === "shipping") {
      basisCents = shippingFeeCents;
    } else if (scope === "order") {
      basisCents = subtotalCents;
    } else if (scope === "category" && row.categoryId) {
      const categoryId = row.categoryId;
      basisCents = items
        .filter((item) =>
          (productCategoryMap.get(item.productId) ?? []).includes(categoryId),
        )
        .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    } else if (scope === "product") {
      if (row.appliesToEsim === 1) {
        basisCents = items
          .filter((item) => item.productId.startsWith("esim_"))
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      } else if (row.productId) {
        basisCents = items
          .filter((item) => item.productId === row.productId)
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      }
    }

    if (basisCents <= 0) continue;

    let discountCents: number;
    if (discountType === "percent") {
      discountCents = Math.round(
        basisCents * (Math.min(100, discountValue) / 100),
      );
    } else {
      discountCents = Math.min(discountValue, basisCents);
    }

    if (discountCents <= 0) continue;

    discounts.push({
      id: row.id,
      label: row.label ?? null,
      scope,
      discountCents,
    });
    totalCents += discountCents;
  }

  return { discounts, totalCents };
}

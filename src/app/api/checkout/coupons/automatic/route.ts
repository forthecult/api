import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  type AutomaticCouponInput,
  type CartLineItem,
  resolveAutomaticCouponForCheckout,
} from "~/lib/coupon";
import { getMemberTierForWallet } from "~/lib/get-member-tier";
import { resolveTierDiscountsForCheckout } from "~/lib/tier-discount";

const validateSchema = {
  items: (v: unknown): CartLineItem[] => {
    if (!Array.isArray(v)) return [];
    return (v as unknown[])
      .filter(
        (
          item,
        ): item is {
          priceCents: number;
          productId: string;
          quantity: number;
        } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).productId === "string",
      )
      .map((item) => {
        const rec = item as Record<string, unknown>;
        const priceCents =
          typeof rec.priceCents === "number"
            ? rec.priceCents
            : Number(rec.priceCents);
        const quantity =
          typeof rec.quantity === "number" ? rec.quantity : Number(rec.quantity);
        return {
          priceCents: Number.isFinite(priceCents)
            ? Math.round(priceCents)
            : 0,
          productId: String(rec.productId),
          quantity: Math.max(1, Number.isFinite(quantity) ? Math.round(quantity) : 1),
        };
      })
      .filter((item) => item.productId.length > 0);
  },
  paymentMethodKey: (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : undefined,
  productCount: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  productIds: (v: unknown) =>
    Array.isArray(v)
      ? (v as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [],
  shippingFeeCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  subtotalCents: (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  },
};

/**
 * POST /api/checkout/coupons/automatic
 * Public API: get the best automatic discount for the current cart. Returns discount info if one applies.
 * Optional body.wallet: when provided, member tier is resolved and tier-based discounts are applied and stacked with the automatic coupon.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const body = (await request.json()) as Record<string, unknown>;
    const subtotalCents = validateSchema.subtotalCents(body?.subtotalCents);
    const shippingFeeCents = validateSchema.shippingFeeCents(
      body?.shippingFeeCents ?? body?.shippingCents,
    );
    const productCount = validateSchema.productCount(body?.productCount);
    const productIds = validateSchema.productIds(body?.productIds);
    const paymentMethodKey = validateSchema.paymentMethodKey(
      body?.paymentMethodKey,
    );
    const wallet =
      typeof body?.wallet === "string" && body.wallet.trim().length > 0
        ? body.wallet.trim()
        : undefined;

    const items = validateSchema.items(body?.items);

    // Derive productIds from items when client sends items but productIds empty (e.g. ensures eSIM rule works)
    const resolvedProductIds =
      productIds.length > 0
        ? productIds
        : (items.length > 0
            ? items.map((i) => i.productId).filter(Boolean)
            : []);

    const input: AutomaticCouponInput = {
      items: items.length > 0 ? items : undefined,
      paymentMethodKey,
      productCount,
      productIds:
        resolvedProductIds.length > 0 ? resolvedProductIds : undefined,
      shippingFeeCents,
      subtotalCents,
      userId: session?.user?.id ?? undefined,
    };

    const orderTotalCents = subtotalCents + shippingFeeCents;

    // Resolve tier-based discounts when wallet is provided (stack with automatic coupon)
    let tierDiscounts: {
      discountCents: number;
      id: string;
      label: null | string;
      scope: string;
    }[] = [];
    let tierDiscountTotalCents = 0;
    if (wallet) {
      const memberTier = await getMemberTierForWallet(wallet);
      if (memberTier != null) {
        const tierResult = await resolveTierDiscountsForCheckout(memberTier, {
          items: items.length > 0 ? items : [],
          shippingFeeCents,
          subtotalCents,
        });
        tierDiscounts = tierResult.discounts;
        tierDiscountTotalCents = tierResult.totalCents;
      }
    }

    const result = await resolveAutomaticCouponForCheckout(input);

    const automaticDiscountCents = result?.discountCents ?? 0;
    const totalDiscountCents = automaticDiscountCents + tierDiscountTotalCents;
    const totalAfterDiscountCents = Math.max(
      0,
      orderTotalCents - totalDiscountCents,
    );

    if (!result && tierDiscountTotalCents === 0) {
      return NextResponse.json({ applied: false });
    }

    return NextResponse.json({
      applied: true,
      ...(result ?? {}),
      tierDiscounts: tierDiscounts.length > 0 ? tierDiscounts : undefined,
      tierDiscountTotalCents:
        tierDiscountTotalCents > 0 ? tierDiscountTotalCents : undefined,
      totalAfterDiscountCents,
      totalDiscountCents: totalDiscountCents,
    });
  } catch (err) {
    console.error("Automatic coupon resolve error:", err);
    return NextResponse.json(
      { applied: false, error: "Failed to resolve automatic discount." },
      { status: 500 },
    );
  }
}

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
          typeof (item as Record<string, unknown>).productId === "string" &&
          typeof (item as Record<string, unknown>).priceCents === "number" &&
          typeof (item as Record<string, unknown>).quantity === "number",
      )
      .map((item) => ({
        priceCents: Math.round((item as CartLineItem).priceCents),
        productId: (item as CartLineItem).productId,
        quantity: Math.max(1, Math.round((item as CartLineItem).quantity)),
      }))
      .filter((item) => item.productId.length > 0);
  },
  paymentMethodKey: (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined,
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
  subtotalCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  /** Optional tier (1–3) when wallet is not sent; e.g. from tier history after user unlinked wallet. */
  memberTier: (v: unknown) =>
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 1 &&
    v <= 3 &&
    Math.round(v) === v
      ? Math.round(v)
      : undefined,
};

/**
 * POST /api/checkout/coupons/automatic
 * Public API: get the best automatic discount for the current cart. Returns discount info if one applies.
 * Optional body.wallet: when provided, member tier is resolved from chain and tier discounts applied.
 * Optional body.memberTier: when wallet is not provided (e.g. user unlinked), send tier 1–3 from /api/user/membership so tier discounts still apply.
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
    const memberTierParam = validateSchema.memberTier(body?.memberTier);

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

    // Resolve tier-based discounts: from wallet (live stake) or from body.memberTier (e.g. tier history when user unlinked)
    let tierDiscounts: {
      discountCents: number;
      id: string;
      label: null | string;
      scope: string;
    }[] = [];
    let tierDiscountTotalCents = 0;
    let resolvedTier: number | null = null;
    if (wallet) {
      resolvedTier = await getMemberTierForWallet(wallet);
    } else if (memberTierParam != null) {
      resolvedTier = memberTierParam;
    }
    if (resolvedTier != null) {
      const tierResult = await resolveTierDiscountsForCheckout(resolvedTier, {
        items: items.length > 0 ? items : [],
        shippingFeeCents,
        subtotalCents,
      });
      tierDiscounts = tierResult.discounts;
      tierDiscountTotalCents = tierResult.totalCents;
    }

    const result = await resolveAutomaticCouponForCheckout(input);

    const automaticDiscountCents = result?.discountCents ?? 0;
    const totalWithAutomaticOnly = Math.max(
      0,
      orderTotalCents - automaticDiscountCents,
    );
    const totalWithTierOnly = Math.max(
      0,
      orderTotalCents - tierDiscountTotalCents,
    );

    // apply the best single discount: tier overrides automatic when tier gives a lower total
    const useTierOnly =
      tierDiscountTotalCents > 0 &&
      totalWithTierOnly <= totalWithAutomaticOnly;

    if (!result && tierDiscountTotalCents === 0) {
      return NextResponse.json({ applied: false });
    }

    if (useTierOnly) {
      return NextResponse.json({
        applied: true,
        discountCents: tierDiscountTotalCents,
        tierDiscounts,
        tierDiscountTotalCents,
        totalAfterDiscountCents: totalWithTierOnly,
      });
    }

    return NextResponse.json({
      applied: true,
      ...(result ?? {}),
      totalAfterDiscountCents: totalWithAutomaticOnly,
    });
  } catch (err) {
    console.error("Automatic coupon resolve error:", err);
    return NextResponse.json(
      { applied: false, error: "Failed to resolve automatic discount." },
      { status: 500 },
    );
  }
}

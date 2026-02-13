import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  resolveAutomaticCouponForCheckout,
  type AutomaticCouponInput,
  type CartLineItem,
} from "~/lib/coupon";

const validateSchema = {
  subtotalCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  shippingFeeCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  productCount: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  productIds: (v: unknown) =>
    Array.isArray(v)
      ? (v as unknown[])
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
  paymentMethodKey: (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : undefined,
  items: (v: unknown): CartLineItem[] => {
    if (!Array.isArray(v)) return [];
    return (v as unknown[])
      .filter(
        (item): item is { productId: string; priceCents: number; quantity: number } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).productId === "string" &&
          typeof (item as Record<string, unknown>).priceCents === "number" &&
          typeof (item as Record<string, unknown>).quantity === "number",
      )
      .map((item) => ({
        productId: item.productId,
        priceCents: Math.round(item.priceCents),
        quantity: Math.max(1, Math.round(item.quantity)),
      }));
  },
};

/**
 * POST /api/checkout/coupons/automatic
 * Public API: get the best automatic discount for the current cart. Returns discount info if one applies.
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

    const items = validateSchema.items(body?.items);

    const input: AutomaticCouponInput = {
      subtotalCents,
      shippingFeeCents,
      productCount,
      productIds: productIds.length > 0 ? productIds : undefined,
      userId: session?.user?.id ?? undefined,
      paymentMethodKey,
      items: items.length > 0 ? items : undefined,
    };

    const result = await resolveAutomaticCouponForCheckout(input);

    if (!result) {
      return NextResponse.json({ applied: false });
    }

    return NextResponse.json({
      applied: true,
      ...result,
    });
  } catch (err) {
    console.error("Automatic coupon resolve error:", err);
    return NextResponse.json(
      { applied: false, error: "Failed to resolve automatic discount." },
      { status: 500 },
    );
  }
}

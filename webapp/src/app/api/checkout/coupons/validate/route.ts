import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { type CartLineItem, resolveCouponForCheckout } from "~/lib/coupon";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "~/lib/rate-limit";

const validateSchema = {
  code: (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null,
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
        priceCents: Math.round(item.priceCents),
        productId: item.productId,
        quantity: Math.max(1, Math.round(item.quantity)),
      }));
  },
  paymentMethodKey: (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : undefined,
  productIds: (v: unknown) =>
    Array.isArray(v)
      ? (v as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [],
  subtotalCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
};

/**
 * POST /api/checkout/coupons/validate
 * Public API: validate a coupon code for checkout. Returns discount info if valid.
 */
export async function POST(request: NextRequest) {
  // Rate limit coupon validation to prevent brute-force code guessing
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`coupon-validate:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const body = (await request.json()) as Record<string, unknown>;
    const code = validateSchema.code(body?.code);
    if (!code) {
      return NextResponse.json(
        { error: "Discount code is required.", valid: false },
        { status: 400 },
      );
    }
    const subtotalCents = validateSchema.subtotalCents(body?.subtotalCents);
    const productIds = validateSchema.productIds(body?.productIds);
    const shippingFeeCents = validateSchema.subtotalCents(
      body?.shippingFeeCents,
    );
    const paymentMethodKey = validateSchema.paymentMethodKey(
      body?.paymentMethodKey,
    );

    const items = validateSchema.items(body?.items);

    const result = await resolveCouponForCheckout(
      code,
      subtotalCents,
      shippingFeeCents,
      {
        items: items.length > 0 ? items : undefined,
        paymentMethodKey,
        productIds: productIds.length > 0 ? productIds : undefined,
        userId: session?.user?.id ?? undefined,
      },
    );

    if (!result) {
      return NextResponse.json({
        error: "This discount code is invalid or expired.",
        valid: false,
      });
    }

    return NextResponse.json({
      valid: true,
      ...result,
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return NextResponse.json(
      { error: "Failed to validate discount code.", valid: false },
      { status: 500 },
    );
  }
}

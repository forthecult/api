import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { resolveCouponForCheckout, type CartLineItem } from "~/lib/coupon";
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} from "~/lib/rate-limit";

const validateSchema = {
  code: (v: unknown) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null,
  subtotalCents: (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  productIds: (v: unknown) =>
    Array.isArray(v)
      ? (v as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [],
  paymentMethodKey: (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : undefined,
  items: (v: unknown): CartLineItem[] => {
    if (!Array.isArray(v)) return [];
    return (v as unknown[])
      .filter(
        (
          item,
        ): item is {
          productId: string;
          priceCents: number;
          quantity: number;
        } =>
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
        { valid: false, error: "Discount code is required." },
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
        userId: session?.user?.id ?? undefined,
        productIds: productIds.length > 0 ? productIds : undefined,
        paymentMethodKey,
        items: items.length > 0 ? items : undefined,
      },
    );

    if (!result) {
      return NextResponse.json({
        valid: false,
        error: "This discount code is invalid or expired.",
      });
    }

    return NextResponse.json({
      valid: true,
      ...result,
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return NextResponse.json(
      { valid: false, error: "Failed to validate discount code." },
      { status: 500 },
    );
  }
}

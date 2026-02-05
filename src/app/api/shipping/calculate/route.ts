import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { runShippingCalculate, ZERO_SHIPPING } from "~/lib/shipping-calculate";
import {
  shippingCalculateSchema,
  validateBody,
} from "~/lib/validations/checkout";

/**
 * Public API: calculates shipping cost for a given country, order value, and line items.
 * Used by checkout to display dynamic shipping. No auth required.
 *
 * Supports:
 * - Admin-configured shipping options
 * - Printful shipping rates (when products are from Printful)
 * - Combined shipping for mixed orders
 * - Free shipping when a valid free_shipping coupon code is provided
 *
 * If no shipping options are configured (or table missing), returns $0 shipping so checkout can proceed.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const validation = validateBody(shippingCalculateSchema, rawBody);
    if (!validation.success) {
      console.warn("Shipping calculate: validation failed", validation.error);
      return NextResponse.json(ZERO_SHIPPING);
    }

    const session = await auth.api.getSession({ headers: request.headers });

    // Extract additional address fields for Printful shipping (optional)
    const extendedInput = {
      ...validation.data,
      stateCode:
        typeof rawBody.stateCode === "string" ? rawBody.stateCode : undefined,
      city: typeof rawBody.city === "string" ? rawBody.city : undefined,
      zip: typeof rawBody.zip === "string" ? rawBody.zip : undefined,
      address1:
        typeof rawBody.address1 === "string" ? rawBody.address1 : undefined,
      couponCode:
        typeof rawBody.couponCode === "string" && rawBody.couponCode.trim()
          ? rawBody.couponCode.trim()
          : undefined,
      userId: session?.user?.id ?? undefined,
    };

    const result = await runShippingCalculate(extendedInput);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Shipping calculate error:", err);
    return NextResponse.json(
      { error: "Failed to calculate shipping" },
      { status: 500 },
    );
  }
}

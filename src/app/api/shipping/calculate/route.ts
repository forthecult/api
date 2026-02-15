import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import {
  getPublicShippingResponse,
  runShippingCalculate,
  ZERO_SHIPPING,
} from "~/lib/shipping-calculate";
import {
  shippingCalculateSchema,
  validateBody,
} from "~/lib/validations/checkout";

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * Public API: calculates shipping cost for a given country, order value, and line items.
 * Used by checkout to display dynamic shipping. No auth required.
 *
 * Supports admin-configured options, fulfillment-provider rates, and free shipping
 * when a valid free_shipping coupon code is provided. Returns $0 shipping if no
 * options are configured so checkout can proceed.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const validation = validateBody(shippingCalculateSchema, rawBody);
    if (!validation.success) {
      console.warn("Shipping calculate: validation failed", validation.error);
      return withPublicApiCors(
        NextResponse.json(getPublicShippingResponse(ZERO_SHIPPING)),
      );
    }

    const session = await auth.api.getSession({ headers: request.headers });

    // Extract additional address fields for Printful shipping (optional)
    const extendedInput = {
      ...validation.data,
      address1:
        typeof rawBody.address1 === "string" ? rawBody.address1 : undefined,
      city: typeof rawBody.city === "string" ? rawBody.city : undefined,
      couponCode:
        typeof rawBody.couponCode === "string" && rawBody.couponCode.trim()
          ? rawBody.couponCode.trim()
          : undefined,
      stateCode:
        typeof rawBody.stateCode === "string" ? rawBody.stateCode : undefined,
      userId: session?.user?.id ?? undefined,
      zip: typeof rawBody.zip === "string" ? rawBody.zip : undefined,
    };

    const result = await runShippingCalculate(extendedInput);
    return withPublicApiCors(
      NextResponse.json(getPublicShippingResponse(result)),
    );
  } catch (err) {
    console.error("Shipping calculate error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to calculate shipping" },
        { status: 500 },
      ),
    );
  }
}

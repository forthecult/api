import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { runProductShippingOptionsEstimate } from "~/lib/shipping-calculate";
import {
  productShippingEstimateSchema,
  validateBody,
} from "~/lib/validations/checkout";

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * Public: per-product shipping option lines for a destination (postal + region when required).
 * Uses the same fulfillment and admin rules as checkout; labels are storefront-safe.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const validation = validateBody(productShippingEstimateSchema, rawBody);
    if (!validation.success) {
      return withPublicApiCors(
        NextResponse.json({
          canShipToCountry: true,
          fulfillmentError: null,
          options: [],
          unavailableProducts: [],
        }),
      );
    }

    const data = validation.data;
    const result = await runProductShippingOptionsEstimate({
      address1:
        typeof rawBody.address1 === "string" ? rawBody.address1 : undefined,
      city: data.city,
      countryCode: data.countryCode,
      productId: data.productId,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      stateCode: data.stateCode,
      zip: data.postalCode?.trim() || undefined,
    });

    return withPublicApiCors(NextResponse.json(result));
  } catch (err) {
    console.error("Product shipping estimate error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { error: "Failed to estimate shipping" },
        { status: 500 },
      ),
    );
  }
}

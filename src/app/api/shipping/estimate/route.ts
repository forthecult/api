import { type NextRequest, NextResponse } from "next/server";

import { runShippingCalculate } from "~/lib/shipping-calculate";
import {
  shippingCalculateSchema,
  validateBody,
} from "~/lib/validations/checkout";

/**
 * Get shipping options and costs. Same as POST /api/shipping/calculate.
 * POST /api/shipping/estimate
 * Body: countryCode (required), items (array of { productId, quantity }), orderValueCents (optional, default 0).
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = validateBody(shippingCalculateSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Require countryCode (2–3 chars) and optional items, orderValueCents.",
        },
        { status: 400 },
      );
    }

    const result = await runShippingCalculate(validation.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Shipping estimate error:", err);
    return NextResponse.json(
      { error: "Failed to estimate shipping" },
      { status: 500 },
    );
  }
}

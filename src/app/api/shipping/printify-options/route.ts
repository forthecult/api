import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { calculatePrintifyShippingOptions } from "~/lib/printify-orders";

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * POST /api/shipping/printify-options
 *
 * Returns all available Printify shipping methods (standard, express, economy,
 * Printify Express) with costs for a given set of items and destination.
 *
 * Used by checkout to show shipping method selection when cart contains
 * Printify products that support multiple shipping tiers.
 *
 * Body:
 * {
 *   items: [{ printifyProductId: string, printifyVariantId: number, quantity: number }],
 *   address: { country: string, region?: string, zip?: string, city?: string }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      items?: Array<{
        printifyProductId: string;
        printifyVariantId: number;
        quantity: number;
      }>;
      address?: {
        country: string;
        region?: string;
        zip?: string;
        city?: string;
      };
    };

    if (!body.items?.length || !body.address?.country) {
      return withPublicApiCors(
        NextResponse.json(
          { options: [], error: "Missing items or address.country" },
          { status: 400 },
        ),
      );
    }

    const result = await calculatePrintifyShippingOptions(
      body.items,
      body.address,
    );

    return withPublicApiCors(NextResponse.json(result));
  } catch (err) {
    console.error("Printify shipping options error:", err);
    return withPublicApiCors(
      NextResponse.json(
        { options: [], error: "Failed to calculate shipping options" },
        { status: 500 },
      ),
    );
  }
}

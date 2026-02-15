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
      address?: {
        city?: string;
        country: string;
        region?: string;
        zip?: string;
      };
      items?: {
        printifyProductId: string;
        printifyVariantId: number;
        quantity: number;
      }[];
    };

    if (!body.items?.length || !body.address?.country) {
      return withPublicApiCors(
        NextResponse.json(
          { error: "Missing items or address.country", options: [] },
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
        { error: "Failed to calculate shipping options", options: [] },
        { status: 500 },
      ),
    );
  }
}

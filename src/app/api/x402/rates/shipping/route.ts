import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { shippingOptionsTable } from "~/db/schema";
import { eq, isNull, or } from "drizzle-orm";

/**
 * GET /api/x402/rates/shipping?countryCode=US
 * Shipping options summary for a country (flat rates, estimated days). Free for agents.
 * For exact cart shipping use POST /api/shipping/calculate.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const countryCode = searchParams.get("countryCode")?.trim()?.toUpperCase();
  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json(
      {
        error: "countryCode required (2-letter ISO, e.g. US)",
        example: "/api/x402/rates/shipping?countryCode=US",
      },
      { status: 400 },
    );
  }

  const options = await db
    .select({
      id: shippingOptionsTable.id,
      name: shippingOptionsTable.name,
      type: shippingOptionsTable.type,
      amountCents: shippingOptionsTable.amountCents,
      additionalItemCents: shippingOptionsTable.additionalItemCents,
      estimatedDaysText: shippingOptionsTable.estimatedDaysText,
      speed: shippingOptionsTable.speed,
      minOrderCents: shippingOptionsTable.minOrderCents,
      countryCode: shippingOptionsTable.countryCode,
    })
    .from(shippingOptionsTable)
    .where(
      or(
        eq(shippingOptionsTable.countryCode, countryCode),
        isNull(shippingOptionsTable.countryCode),
      ),
    )
    .limit(50);

  const forCountry = options.filter(
    (o) => o.countryCode === countryCode || o.countryCode == null,
  );

  return NextResponse.json({
    countryCode,
    options: forCountry.map((o) => ({
      name: o.name,
      type: o.type,
      amountUsd: o.amountCents != null ? o.amountCents / 100 : null,
      additionalItemUsd:
        o.additionalItemCents != null ? o.additionalItemCents / 100 : null,
      estimatedDays: o.estimatedDaysText ?? null,
      speed: o.speed,
      minOrderUsd: o.minOrderCents != null ? o.minOrderCents / 100 : null,
    })),
    total: forCountry.length,
    _note:
      "For exact shipping cost use POST /api/shipping/calculate with cart.",
  });
}

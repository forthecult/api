import { eq, isNull, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { shippingOptionsTable } from "~/db/schema";

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
      additionalItemCents: shippingOptionsTable.additionalItemCents,
      amountCents: shippingOptionsTable.amountCents,
      countryCode: shippingOptionsTable.countryCode,
      estimatedDaysText: shippingOptionsTable.estimatedDaysText,
      id: shippingOptionsTable.id,
      minOrderCents: shippingOptionsTable.minOrderCents,
      name: shippingOptionsTable.name,
      speed: shippingOptionsTable.speed,
      type: shippingOptionsTable.type,
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
    _note:
      "For exact shipping cost use POST /api/shipping/calculate with cart.",
    countryCode,
    options: forCountry.map((o) => ({
      additionalItemUsd:
        o.additionalItemCents != null ? o.additionalItemCents / 100 : null,
      amountUsd: o.amountCents != null ? o.amountCents / 100 : null,
      estimatedDays: o.estimatedDaysText ?? null,
      minOrderUsd: o.minOrderCents != null ? o.minOrderCents / 100 : null,
      name: o.name,
      speed: o.speed,
      type: o.type,
    })),
    total: forCountry.length,
  });
}

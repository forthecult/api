import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable } from "~/db/schema";

/**
 * GET /api/affiliates/validate?code=XXX
 * Returns whether the affiliate code is valid (approved) and optional customer discount info.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code || code.length === 0) {
    return NextResponse.json(
      { valid: false, error: "Code is required" },
      { status: 400 },
    );
  }

  const normalizedCode = code.toUpperCase();

  const [affiliate] = await db
    .select({
      id: affiliateTable.id,
      code: affiliateTable.code,
      status: affiliateTable.status,
      customerDiscountType: affiliateTable.customerDiscountType,
      customerDiscountValue: affiliateTable.customerDiscountValue,
    })
    .from(affiliateTable)
    .where(eq(affiliateTable.code, normalizedCode))
    .limit(1);

  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.json({ valid: false });
  }

  const response: {
    valid: true;
    code: string;
    discountType?: "percent" | "fixed";
    discountValue?: number;
  } = {
    valid: true,
    code: affiliate.code,
  };

  if (
    affiliate.customerDiscountType &&
    affiliate.customerDiscountValue != null &&
    affiliate.customerDiscountValue > 0
  ) {
    if (
      affiliate.customerDiscountType === "percent" ||
      affiliate.customerDiscountType === "fixed"
    ) {
      response.discountType = affiliate.customerDiscountType;
      response.discountValue = affiliate.customerDiscountValue;
    }
  }

  return NextResponse.json(response);
}

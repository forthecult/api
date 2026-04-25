import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

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
      { error: "Code is required", valid: false },
      { status: 400 },
    );
  }

  const normalizedCode = code.toUpperCase();

  const [affiliate] = await db
    .select({
      code: affiliateTable.code,
      customerDiscountType: affiliateTable.customerDiscountType,
      customerDiscountValue: affiliateTable.customerDiscountValue,
      id: affiliateTable.id,
      status: affiliateTable.status,
    })
    .from(affiliateTable)
    .where(eq(affiliateTable.code, normalizedCode))
    .limit(1);

  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.json({ valid: false });
  }

  const response: {
    code: string;
    discountType?: "fixed" | "percent";
    discountValue?: number;
    valid: true;
  } = {
    code: affiliate.code,
    valid: true,
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

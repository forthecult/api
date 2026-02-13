import { NextResponse } from "next/server";

import { getEsimPackageDetail } from "~/lib/esim-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimPackageDetail(id);

    // Apply markup
    const data = {
      ...result.data,
      reseller_price: result.data.price,
      price: (Number(result.data.price) * (1 + markup / 100)).toFixed(2),
    };

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM package detail error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch package details" },
      { status: 500 },
    );
  }
}

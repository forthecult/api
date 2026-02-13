import { NextResponse } from "next/server";

import { getEsimPackageDetail } from "~/lib/esim-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { status: false, message: "Package ID is required" },
        { status: 400 },
      );
    }

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;
    const result = await getEsimPackageDetail(id.trim());

    if (!result?.status || !result?.data) {
      return NextResponse.json({
        status: false,
        available: false,
        message: "This eSIM is currently unavailable.",
      });
    }

    const pkg = result.data;
    const data = {
      ...pkg,
      reseller_price: pkg.price,
      price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
    };

    return NextResponse.json({ status: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("eSIM package detail error:", message, error);
    // Provider 404/500 or "not found" → product unavailable; return 200 so no HTTP error, client shows "Sold out" / "Unavailable"
    if (
      message.includes("404") ||
      message.includes("500") ||
      message.includes("not found")
    ) {
      return NextResponse.json({
        status: false,
        available: false,
        message: "This eSIM is currently unavailable.",
      });
    }
    return NextResponse.json(
      {
        status: false,
        message: "Failed to fetch package details",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  }
}

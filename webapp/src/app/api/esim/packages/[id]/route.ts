import { NextResponse } from "next/server";

import { getEsimPackageDetailWithRetry } from "~/lib/esim-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { message: "Package ID is required", status: false },
        { status: 400 },
      );
    }

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;
    const result = await getEsimPackageDetailWithRetry(id.trim());

    if (!result?.status || !result?.data) {
      return NextResponse.json({
        available: false,
        message: "This eSIM is currently unavailable.",
        status: false,
      });
    }

    const pkg = result.data;
    const data = {
      ...pkg,
      price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
      reseller_price: pkg.price,
    };

    return NextResponse.json({ data, status: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("eSIM package detail error:", message, error);
    // Any failure fetching the package → treat as unavailable (return 200 so the client never sees an HTTP error)
    return NextResponse.json({
      available: false,
      message: "This eSIM is currently unavailable.",
      status: false,
    });
  }
}

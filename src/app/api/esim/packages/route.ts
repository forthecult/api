import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { getEsimPackages } from "~/lib/esim-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageType =
      (searchParams.get("package_type") as "DATA-ONLY" | "DATA-VOICE-SMS") ||
      "DATA-ONLY";
    const page = Number(searchParams.get("page")) || 1;

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimPackages(packageType, page);

    // Apply markup to prices
    const data = result.data.map((pkg) => ({
      ...pkg,
      reseller_price: pkg.price,
      price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
    }));

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM packages error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch packages" },
      { status: 500 },
    );
  }
}

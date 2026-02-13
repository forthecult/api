import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { getEsimGlobalPackages } from "~/lib/esim-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageType =
      (searchParams.get("package_type") as "DATA-ONLY" | "DATA-VOICE-SMS") ||
      "DATA-ONLY";

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimGlobalPackages(packageType);

    const data = result.data.map((pkg) => ({
      ...pkg,
      reseller_price: pkg.price,
      price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
    }));

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM global packages error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch global packages" },
      { status: 500 },
    );
  }
}

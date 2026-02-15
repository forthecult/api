import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  checkPackageAvailability,
  getEsimGlobalPackages,
} from "~/lib/esim-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageType =
      (searchParams.get("package_type") as "DATA-ONLY" | "DATA-VOICE-SMS") ||
      "DATA-ONLY";

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimGlobalPackages(packageType);

    // Check availability + 5G in parallel and drop unavailable packages
    const enriched = await Promise.all(
      result.data.map(async (pkg) => {
        const { available, has5g } = await checkPackageAvailability(pkg.id);
        return { available, has5g, pkg };
      }),
    );

    const data = enriched
      .filter((e) => e.available)
      .map(({ has5g, pkg }) => ({
        ...pkg,
        has5g,
        price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
        reseller_price: pkg.price,
      }));

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM global packages error:", error);
    return NextResponse.json(
      { message: "Failed to fetch global packages", status: false },
      { status: 500 },
    );
  }
}

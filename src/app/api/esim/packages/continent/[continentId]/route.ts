import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import {
  checkPackageAvailability,
  getEsimContinentPackages,
} from "~/lib/esim-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ continentId: string }> },
) {
  try {
    const { continentId } = await params;
    const { searchParams } = new URL(request.url);
    const packageType = searchParams.get("package_type") as
      | "DATA-ONLY"
      | "DATA-VOICE-SMS"
      | null;
    const page = Number(searchParams.get("page")) || 1;

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimContinentPackages(
      Number(continentId),
      packageType ?? undefined,
      page,
    );

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
    console.error("eSIM continent packages error:", error);
    return NextResponse.json(
      { message: "Failed to fetch continent packages", status: false },
      { status: 500 },
    );
  }
}

import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { getEsimContinentPackages, getPackageHas5g } from "~/lib/esim-api";

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

    const data = await Promise.all(
      result.data.map(async (pkg) => {
        const has5g = await getPackageHas5g(pkg.id);
        return {
          ...pkg,
          reseller_price: pkg.price,
          price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
          has5g,
        };
      }),
    );

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM continent packages error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch continent packages" },
      { status: 500 },
    );
  }
}

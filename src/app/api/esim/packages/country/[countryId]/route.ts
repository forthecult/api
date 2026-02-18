import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { getEsimCountryPackages } from "~/lib/esim-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryId: string }> },
) {
  try {
    const { countryId } = await params;
    const { searchParams } = new URL(request.url);
    const packageType = searchParams.get("package_type") as
      | "DATA-ONLY"
      | "DATA-VOICE-SMS"
      | null;
    const page = Number(searchParams.get("page")) || 1;

    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;

    const result = await getEsimCountryPackages(
      Number(countryId),
      packageType ?? undefined,
      page,
    );

    // Provider may return mixed types; filter to the requested type so "Data + Voice + SMS" only shows those.
    const requestedType = packageType ?? "DATA-ONLY";
    const filtered = result.data.filter(
      (pkg) => (pkg.package_type ?? "DATA-ONLY") === requestedType,
    );

    const data = filtered.map((pkg) => ({
      ...pkg,
      price: (Number(pkg.price) * (1 + markup / 100)).toFixed(2),
      reseller_price: pkg.price,
    }));

    return NextResponse.json({ ...result, data });
  } catch (error) {
    console.error("eSIM country packages error:", error);
    return NextResponse.json(
      { message: "Failed to fetch country packages", status: false },
      { status: 500 },
    );
  }
}

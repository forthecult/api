import { type NextRequest, NextResponse } from "next/server";

import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";
import { withOptionalX402 } from "~/lib/x402-config";

const METALS = ["XAU", "XAG"];

/**
 * GET /api/x402/rates/metals-fiat?metal=XAU&fiat=USD
 * Precious metal (gold/silver) to fiat. Only USD supported (CoinGecko PAX Gold / Kinesis Silver).
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const metal = (searchParams.get("metal") ?? "XAU").toUpperCase();
  const fiat = (searchParams.get("fiat") ?? "USD").toUpperCase();
  if (!METALS.includes(metal)) {
    return NextResponse.json(
      { error: "Unsupported metal", metal, supported: METALS },
      { status: 400 },
    );
  }
  if (fiat !== "USD") {
    return NextResponse.json(
      { error: "Only fiat=USD supported for metals", metal, fiat },
      { status: 400 },
    );
  }
  const prices = await getCryptoAndMetalPricesUsd();
  const rate = prices[metal];
  if (rate == null) {
    return NextResponse.json(
      { error: "Rate temporarily unavailable", metal, fiat },
      { status: 503 },
    );
  }
  return NextResponse.json({
    metal,
    fiat,
    rate,
    source: "coingecko",
    _note: "XAU = USD per troy oz (PAX Gold); XAG = USD per troy oz (Kinesis Silver)",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/metals-fiat");

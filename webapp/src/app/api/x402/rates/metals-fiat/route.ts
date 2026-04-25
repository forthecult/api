import { type NextRequest, NextResponse } from "next/server";

import { withOptionalX402 } from "~/lib/x402-config";
import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";

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
      { error: "Only fiat=USD supported for metals", fiat, metal },
      { status: 400 },
    );
  }
  const prices = await getCryptoAndMetalPricesUsd();
  const rate = prices[metal];
  if (rate == null) {
    return NextResponse.json(
      { error: "Rate temporarily unavailable", fiat, metal },
      { status: 503 },
    );
  }
  return NextResponse.json({
    _note:
      "XAU = USD per troy oz (PAX Gold); XAG = USD per troy oz (Kinesis Silver)",
    fiat,
    metal,
    rate,
    source: "coingecko",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/metals-fiat");

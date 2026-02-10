import { type NextRequest, NextResponse } from "next/server";

import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";
import { withOptionalX402 } from "~/lib/x402-config";

const METALS = ["XAU", "XAG"];
const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "TON", "XMR"];

/**
 * GET /api/x402/rates/metals-crypto?metal=XAU&crypto=ETH
 * Precious metal to crypto (e.g. 1 oz gold in ETH).
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const metal = (searchParams.get("metal") ?? "XAU").toUpperCase();
  const crypto = (searchParams.get("crypto") ?? "ETH").toUpperCase();
  if (!METALS.includes(metal)) {
    return NextResponse.json(
      { error: "Unsupported metal", metal, supported: METALS },
      { status: 400 },
    );
  }
  if (!CRYPTO_SYMBOLS.includes(crypto)) {
    return NextResponse.json(
      { error: "Unsupported crypto", crypto, supported: CRYPTO_SYMBOLS },
      { status: 400 },
    );
  }
  const prices = await getCryptoAndMetalPricesUsd();
  const metalUsd = prices[metal];
  const cryptoUsd = prices[crypto];
  if (metalUsd == null || cryptoUsd == null || cryptoUsd === 0) {
    return NextResponse.json(
      { error: "Rate temporarily unavailable", metal, crypto },
      { status: 503 },
    );
  }
  const rate = metalUsd / cryptoUsd;
  return NextResponse.json({
    metal,
    crypto,
    rate,
    source: "coingecko",
    _note: "1 unit of metal in units of crypto",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/metals-crypto");

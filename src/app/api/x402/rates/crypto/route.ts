import { type NextRequest, NextResponse } from "next/server";

import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";
import { withOptionalX402 } from "~/lib/x402-config";

const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "TON", "XMR", "XAU", "XAG"];

/**
 * GET /api/x402/rates/crypto?from=ETH&to=BTC
 * Crypto-to-crypto rate (via USD).
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = (searchParams.get("from") ?? "ETH").toUpperCase();
  const to = (searchParams.get("to") ?? "BTC").toUpperCase();
  if (!CRYPTO_SYMBOLS.includes(from) || !CRYPTO_SYMBOLS.includes(to)) {
    return NextResponse.json(
      {
        error: "Unsupported crypto or metal",
        from,
        to,
        supported: CRYPTO_SYMBOLS,
      },
      { status: 400 },
    );
  }
  const prices = await getCryptoAndMetalPricesUsd();
  const fromUsd = prices[from];
  const toUsd = prices[to];
  if (fromUsd == null || toUsd == null || toUsd === 0) {
    return NextResponse.json(
      { error: "Rate temporarily unavailable", from, to },
      { status: 503 },
    );
  }
  const rate = fromUsd / toUsd;
  return NextResponse.json({
    from,
    to,
    rate,
    source: "coingecko",
    _note: "1 unit of 'from' in units of 'to'",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/crypto");

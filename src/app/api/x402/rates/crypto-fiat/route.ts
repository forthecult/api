import { type NextRequest, NextResponse } from "next/server";

import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";
import { withOptionalX402 } from "~/lib/x402-config";

const CRYPTO_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "TON",
  "XMR",
  "XAU",
  "XAG",
];

/**
 * GET /api/x402/rates/crypto-fiat?crypto=ETH&fiat=USD
 * Crypto (or metal) to fiat rate. Fiat must be USD for now (prices from CoinGecko).
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const crypto = (searchParams.get("crypto") ?? "ETH").toUpperCase();
  const fiat = (searchParams.get("fiat") ?? "USD").toUpperCase();
  if (fiat !== "USD") {
    return NextResponse.json(
      {
        error: "Only fiat=USD is supported; crypto prices are in USD",
        crypto,
        fiat,
      },
      { status: 400 },
    );
  }
  if (!CRYPTO_SYMBOLS.includes(crypto)) {
    return NextResponse.json(
      {
        error: "Unsupported crypto or metal",
        crypto,
        supported: CRYPTO_SYMBOLS,
      },
      { status: 400 },
    );
  }
  const prices = await getCryptoAndMetalPricesUsd();
  const rate = prices[crypto];
  if (rate == null) {
    return NextResponse.json(
      { error: "Rate temporarily unavailable", crypto, fiat },
      { status: 503 },
    );
  }
  return NextResponse.json({
    crypto,
    fiat,
    rate,
    source: "coingecko",
    _note: "1 unit of crypto in fiat",
  });
}

export const GET = withOptionalX402(getHandler, "x402/rates/crypto-fiat");

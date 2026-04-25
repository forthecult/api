import { type NextRequest, NextResponse } from "next/server";

import { getCryptoAndMetalPricesUsd } from "~/lib/x402-rates";
import { getBulkProductPricesAndImages } from "~/lib/x402-rates";

const MAX_IDS = 200;
const TOKENS = ["BTC", "ETH", "SOL", "DOGE", "TON", "XMR", "USDC", "USDT"];

/**
 * POST /api/x402/rates/products-crypto
 * Body: { productIds: string[], token?: string } — bulk product prices in crypto. token defaults to ETH. Free for shopping.
 */
export async function POST(request: NextRequest) {
  let body: { productIds?: string[]; token?: string };
  try {
    body = (await request.json()) as { productIds?: string[]; token?: string };
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON body; expected { productIds: string[], token?: string }",
      },
      { status: 400 },
    );
  }
  const raw = body?.productIds;
  const productIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
  if (productIds.length === 0) {
    return NextResponse.json(
      { error: "productIds array required (max 200)", products: [] },
      { status: 400 },
    );
  }
  const token = (body?.token ?? "ETH").toUpperCase();
  if (!TOKENS.includes(token)) {
    return NextResponse.json(
      { error: "Unsupported token", supported: TOKENS, token },
      { status: 400 },
    );
  }

  const [products, prices] = await Promise.all([
    getBulkProductPricesAndImages(productIds),
    getCryptoAndMetalPricesUsd(),
  ]);

  const tokenUsd = token === "USDC" || token === "USDT" ? 1 : prices[token];
  if (tokenUsd == null || tokenUsd <= 0) {
    return NextResponse.json(
      { error: "Token rate temporarily unavailable", token },
      { status: 503 },
    );
  }

  return NextResponse.json({
    products: products.map((p) => ({
      productId: p.productId,
      [token]: p.usd / tokenUsd,
      usd: p.usd,
    })),
    token,
    tokenUsd,
    total: products.length,
  });
}

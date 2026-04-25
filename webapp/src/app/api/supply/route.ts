/**
 * Public CULT supply endpoint — JSON snapshot.
 *
 * Returns max, total, circulating, and burned supply read directly from
 * Solana mainnet. Companion plain-text routes at `/api/supply/{total,
 * circulating,max,burned}` exist for CoinMarketCap and CoinGecko pollers.
 *
 * Cached for 60s edge-side; stale cache is served on upstream RPC failure.
 */

import { NextResponse } from "next/server";

import { getCultSupply } from "~/lib/cult-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const s = await getCultSupply();
    return NextResponse.json(
      {
        burnedSupply: s.burnedSupply,
        circulatingSupply: s.circulatingSupply,
        decimals: s.decimals,
        fetchedAt: s.fetchedAt,
        maxSupply: s.maxSupply,
        mint: s.mint,
        network: s.network,
        stale: s.stale,
        symbol: s.symbol,
        totalSupply: s.totalSupply,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return new NextResponse("upstream unavailable", { status: 503 });
  }
}

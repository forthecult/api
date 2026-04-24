/**
 * Plain-text CULT circulating supply for CoinMarketCap / CoinGecko feeds.
 *
 * Circulating = total − sum of balances in CULT_EXCLUDED_ADDRESSES.
 * Without an env override this equals total supply.
 */

import { getCultSupply } from "~/lib/cult-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const s = await getCultSupply();
    return new Response(s.circulatingSupply.toString(), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response("upstream unavailable", { status: 503 });
  }
}

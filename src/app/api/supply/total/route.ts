/**
 * Plain-text CULT total supply. Format matches the convention CoinMarketCap
 * and CoinGecko expect for self-reported supply feeds: a single number,
 * no quotes, no JSON, no trailing newline.
 */

import { getCultSupply } from "~/lib/cult-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const s = await getCultSupply();
    return new Response(s.totalSupply.toString(), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response("upstream unavailable", { status: 503 });
  }
}

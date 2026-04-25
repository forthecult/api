/**
 * Plain-text CULT burned supply (maxSupply − totalSupply).
 * Useful for public dashboards that visualise buyback-and-burn progress.
 */

import { getCultSupply } from "~/lib/cult-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const s = await getCultSupply();
    return new Response(s.burnedSupply.toString(), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response("upstream unavailable", { status: 503 });
  }
}

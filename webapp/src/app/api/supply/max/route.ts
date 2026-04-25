/**
 * Plain-text CULT max (launch) supply. Static unless CULT_MAX_SUPPLY is
 * overridden; exposed as a route so exchange listings can poll a single
 * host for all supply fields.
 */

import { getCultSupply } from "~/lib/cult-supply";

export const revalidate = 60;

export async function GET() {
  try {
    const s = await getCultSupply();
    return new Response(s.maxSupply.toString(), {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response("upstream unavailable", { status: 503 });
  }
}

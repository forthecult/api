import { NextResponse } from "next/server";

import { getServerVeniceApiKey } from "~/lib/ai/venice";

/**
 * Proxies Venice character list (server key only). No secrets returned.
 */
export async function GET(request: Request) {
  const key = getServerVeniceApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "Venice API is not configured" },
      { status: 503 },
    );
  }
  const url = new URL("https://api.venice.ai/api/v1/characters");
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (q) url.searchParams.set("q", q);
  const limit = searchParams.get("limit");
  if (limit) url.searchParams.set("limit", limit);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  return new NextResponse(text, {
    headers: { "Content-Type": "application/json" },
    status: res.status,
  });
}

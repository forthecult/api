import { NextResponse } from "next/server";

import { getServerVeniceApiKey } from "~/lib/ai/venice";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: Params) {
  const key = getServerVeniceApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "Venice API is not configured" },
      { status: 503 },
    );
  }
  const { slug } = await context.params;
  const enc = encodeURIComponent(slug);
  const res = await fetch(`https://api.venice.ai/api/v1/characters/${enc}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  return new NextResponse(text, {
    headers: { "Content-Type": "application/json" },
    status: res.status,
  });
}

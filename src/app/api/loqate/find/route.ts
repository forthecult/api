/**
 * Loqate Address Capture Find (type-ahead). Requires LOQATE_API_KEY in env.
 * Get a key at https://www.loqate.com/ (14-day free trial).
 */
import { type NextRequest, NextResponse } from "next/server";

import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "~/lib/rate-limit";

const LOQATE_FIND_BASE =
  "https://api.addressy.com/Capture/Interactive/Find/v1.20/json6.ws";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
    `loqate:${ip}`,
    RATE_LIMITS.loqate,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  const key = process.env.LOQATE_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { error: "Loqate is not configured" },
      { status: 503 },
    );
  }

  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  const countries = request.nextUrl.searchParams.get("countries")?.trim() ?? "";
  const container = request.nextUrl.searchParams.get("container")?.trim() ?? "";
  const limit = request.nextUrl.searchParams.get("limit")?.trim() || "10";

  if (!text) {
    return NextResponse.json({ Items: [] });
  }

  const params = new URLSearchParams({
    Key: key,
    Text: text,
    Limit: limit,
  });
  if (countries) params.set("Countries", countries);
  if (container) params.set("Container", container);

  try {
    const res = await fetch(`${LOQATE_FIND_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Address lookup failed" },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { Items?: unknown[]; Error?: string };
    if (data.Error) {
      return NextResponse.json(
        { error: data.Error || "Address lookup failed" },
        { status: 400 },
      );
    }
    return NextResponse.json({ Items: data.Items ?? [] });
  } catch (err) {
    console.error("Loqate Find error:", err);
    return NextResponse.json(
      { error: "Address lookup failed" },
      { status: 502 },
    );
  }
}

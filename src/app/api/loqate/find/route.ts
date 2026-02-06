/**
 * Loqate Address Capture Find (type-ahead). Requires LOQATE_API_KEY in env.
 * Get a key at https://www.loqate.com/ (14-day free trial).
 * Responses are cached in-memory (5 min TTL) to speed up repeated/similar queries.
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

const FIND_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FIND_CACHE_MAX_ENTRIES = 300;

type CacheEntry = { items: unknown[]; expiresAt: number };
const findCache = new Map<string, CacheEntry>();

function getCacheKey(text: string, countries: string, limit: string): string {
  return `${text.toLowerCase().trim()}|${countries.trim()}|${limit}`;
}

function getCached(key: string): unknown[] | null {
  const entry = findCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) findCache.delete(key);
    return null;
  }
  return entry.items;
}

function setCache(key: string, items: unknown[]): void {
  if (findCache.size >= FIND_CACHE_MAX_ENTRIES) {
    const firstKey = findCache.keys().next().value;
    if (firstKey !== undefined) findCache.delete(firstKey);
  }
  findCache.set(key, {
    items,
    expiresAt: Date.now() + FIND_CACHE_TTL_MS,
  });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
    `loqate:${ip}`,
    RATE_LIMITS.loqate,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  const apiKey = process.env.LOQATE_API_KEY;
  if (!apiKey?.trim()) {
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

  const cacheKey = getCacheKey(text, countries, limit);
  const cached = getCached(cacheKey);
  if (cached !== null) {
    return NextResponse.json({ Items: cached });
  }

  const params = new URLSearchParams({
    Key: apiKey,
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
    const items = data.Items ?? [];
    setCache(cacheKey, items);
    return NextResponse.json({ Items: items });
  } catch (err) {
    console.error("Loqate Find error:", err);
    return NextResponse.json(
      { error: "Address lookup failed" },
      { status: 502 },
    );
  }
}

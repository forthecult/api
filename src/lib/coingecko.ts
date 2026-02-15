/**
 * CoinGecko API client with in-memory cache and rate limiting.
 * Plan limits: 30 req/min, 10k calls/mo, data freshness from 60 sec.
 * We cache 60s and cap at 10 req/60s per process so multiple instances stay under 30/min total.
 */

const CACHE_TTL_MS = 60 * 1000; // 60s - matches API data freshness
const RATE_LIMIT_PER_MIN = 10; // per process; keeps total under 30/min with 3+ instances
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type CacheEntry = {
  data: Record<string, { usd?: number }>;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const requestTimestamps: number[] = [];

function pruneTimestamps(now: number): void {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < cutoff) {
    requestTimestamps.shift();
  }
}

function canMakeRequest(now: number): boolean {
  pruneTimestamps(now);
  return requestTimestamps.length < RATE_LIMIT_PER_MIN;
}

function recordRequest(now: number): void {
  requestTimestamps.push(now);
  pruneTimestamps(now);
}

/**
 * Fetch simple/price from CoinGecko. Cached 60s. Respects 30/min rate limit.
 * If at limit, returns stale cache or undefined (caller should use fallback).
 */
export async function getCoinGeckoSimplePrice(
  ids: string[],
): Promise<Record<string, { usd?: number }> | undefined> {
  const key = [...ids].sort().join(",");
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data;
  }

  if (!canMakeRequest(now)) {
    if (hit) return hit.data;
    return undefined;
  }

  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", key);
  url.searchParams.set("vs_currencies", "usd");
  if (apiKey) url.searchParams.set("x_cg_demo_api_key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as Record<string, { usd?: number }>;
    recordRequest(Date.now());
    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    if (hit) return hit.data;
    return undefined;
  }
}

const TOKEN_PRICE_CACHE = new Map<string, CacheEntry>();

/**
 * Fetch token price by platform and contract address(es).
 * e.g. platformId "solana", contractAddresses ["pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"]
 * Cached 60s. Uses same rate limit as simple price.
 */
export async function getCoinGeckoTokenPrice(
  platformId: string,
  contractAddresses: string[],
): Promise<Record<string, { usd?: number }> | undefined> {
  if (contractAddresses.length === 0) return undefined;
  const key = `token:${platformId}:${contractAddresses.join(",")}`;
  const now = Date.now();

  const hit = TOKEN_PRICE_CACHE.get(key);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data;
  }

  if (!canMakeRequest(now)) {
    if (hit) return hit.data;
    return undefined;
  }

  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  const url = new URL(
    `https://api.coingecko.com/api/v3/simple/token_price/${platformId}`,
  );
  url.searchParams.set("contract_addresses", contractAddresses.join(","));
  url.searchParams.set("vs_currencies", "usd");
  if (apiKey) url.searchParams.set("x_cg_demo_api_key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as Record<string, { usd?: number }>;
    recordRequest(Date.now());
    TOKEN_PRICE_CACHE.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    if (hit) return hit.data;
    return undefined;
  }
}

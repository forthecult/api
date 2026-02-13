/**
 * Fetch live market cap & price for any Solana SPL token using DexScreener.
 *
 * DexScreener is free, no API key required, and covers pump.fun tokens.
 * Results are cached in-memory for 30 seconds to avoid rate limits.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenMarketData {
  /** Token price in USD. */
  priceUsd: number;
  /** Fully diluted market cap in USD. */
  marketCapUsd: number;
  /** 24h volume in USD. */
  volume24hUsd: number;
  /** Liquidity in USD. */
  liquidityUsd: number;
  /** DEX where this pair was found (e.g. "raydium", "pump.fun"). */
  dexId: string;
  /** When this data was fetched. */
  fetchedAt: number; // epoch ms
}

// ---------------------------------------------------------------------------
// In-memory cache (30 second TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { data: TokenMarketData; expiresAt: number }>();

// ---------------------------------------------------------------------------
// DexScreener response types (minimal)
// ---------------------------------------------------------------------------

interface DexScreenerPair {
  baseToken: { address: string; symbol: string };
  priceUsd: string;
  fdv: number;
  volume: { h24: number };
  liquidity: { usd: number };
  dexId: string;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch token market data for a Solana SPL token by mint address.
 * Returns null if the token is not found on any DEX.
 */
export async function fetchTokenMarketData(
  mintAddress: string,
): Promise<TokenMarketData | null> {
  // Check cache first
  const cached = cache.get(mintAddress);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Next.js fetch caching: revalidate every 30s
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      console.error(
        `[market-cap] DexScreener responded ${res.status} for ${mintAddress}`,
      );
      return null;
    }

    const json = (await res.json()) as DexScreenerResponse;
    const pairs = json.pairs;
    if (!pairs || pairs.length === 0) return null;

    // Pick the pair with the highest liquidity
    const best = pairs.reduce((a, b) =>
      (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
    );

    const data: TokenMarketData = {
      priceUsd: parseFloat(best.priceUsd) || 0,
      marketCapUsd: best.fdv ?? 0,
      volume24hUsd: best.volume?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      dexId: best.dexId ?? "unknown",
      fetchedAt: Date.now(),
    };

    // Store in cache
    cache.set(mintAddress, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    console.error("[market-cap] Failed to fetch from DexScreener:", err);
    return null;
  }
}

/**
 * Convert a USD amount to token quantity at the current price.
 * Returns null if price data is unavailable.
 */
export function usdToTokens(
  usdAmount: number,
  priceUsd: number,
  decimals: number,
): { human: number; raw: bigint } | null {
  if (!priceUsd || priceUsd <= 0) return null;
  const human = usdAmount / priceUsd;
  const raw = BigInt(Math.floor(human * 10 ** decimals));
  return { human, raw };
}

/**
 * GET /api/governance/token-price
 *
 * Returns live pricing data for the active membership token:
 *   - Token price, market cap, volume, liquidity
 *   - Tier prices (USD cost & token quantity for each tier)
 *   - Pool staker count
 *
 * Cached 30s via DexScreener + in-memory cache in market-cap.ts.
 */

import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getActiveToken } from "~/lib/token-config";
import { fetchPoolStats, getStakingProgramId } from "~/lib/cult-staking";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = getActiveToken();

  // Fetch market data from DexScreener
  const market = await fetchTokenMarketData(token.mint);
  if (!market) {
    return NextResponse.json(
      {
        status: false,
        message: "Unable to fetch market data. The token may not be listed on a DEX yet.",
        token: {
          symbol: token.symbol,
          mint: token.mint,
        },
      },
      { status: 503 },
    );
  }

  // Fetch on-chain staker count
  let stakerCount = 0;
  const programId = getStakingProgramId();
  if (programId) {
    try {
      const connection = new Connection(getSolanaRpcUrlServer());
      const pool = await fetchPoolStats(connection, programId);
      if (pool) {
        stakerCount = pool.totalStakers;
      }
    } catch {
      // Non-critical: default to 0 stakers
    }
  }

  // Compute tier pricing
  const pricing = computeTierPricing(
    token,
    market.priceUsd,
    market.marketCapUsd,
    stakerCount,
  );

  return NextResponse.json({
    status: true,
    data: {
      token: {
        symbol: token.symbol,
        mint: token.mint,
        decimals: token.decimals,
        priceUsd: market.priceUsd,
      },
      market: {
        marketCapUsd: market.marketCapUsd,
        volume24hUsd: market.volume24hUsd,
        liquidityUsd: market.liquidityUsd,
        dexId: market.dexId,
      },
      staking: {
        stakerCount,
        programConfigured: !!programId,
      },
      pricing: {
        bracket: pricing.marketCapBracket,
        tiers: pricing.tiers.map((t) => ({
          tierId: t.tierId,
          costUsd: t.costUsd,
          tokensNeeded: t.tokensNeeded,
          tokensRaw: t.tokensRaw.toString(),
        })),
      },
      fetchedAt: market.fetchedAt,
    },
  });
}

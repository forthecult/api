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

import { fetchPoolStats, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = getActiveToken();

  // Fetch market data from DexScreener
  const market = await fetchTokenMarketData(token.mint);
  if (!market) {
    return NextResponse.json(
      {
        message:
          "Unable to fetch market data. The token may not be listed on a DEX yet.",
        status: false,
        token: {
          mint: token.mint,
          symbol: "CULT",
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
    data: {
      fetchedAt: market.fetchedAt,
      market: {
        dexId: market.dexId,
        liquidityUsd: market.liquidityUsd,
        marketCapUsd: market.marketCapUsd,
        volume24hUsd: market.volume24hUsd,
      },
      pricing: {
        bracket: pricing.marketCapBracket,
        tiers: pricing.tiers.map((t) => ({
          costUsd: t.costUsd,
          tierId: t.tierId,
          tokensNeeded: t.tokensNeeded,
          tokensRaw: t.tokensRaw.toString(),
        })),
      },
      staking: {
        programConfigured: !!programId,
        stakerCount,
      },
      token: {
        decimals: token.decimals,
        mint: token.mint,
        priceUsd: market.priceUsd,
        symbol: pricing.tokenSymbol,
      },
    },
    status: true,
  });
}

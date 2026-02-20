/**
 * Server-only: resolve CULT member tier (1–3) from a staking wallet.
 * Returns null if staking is not configured or wallet has no stake.
 * Falls back to default token thresholds if market data is unavailable.
 */

import { Connection } from "@solana/web3.js";

import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

// fallback token thresholds (used when market data is unavailable)
// these match the pricing at ~$0.00005/token with the bonding curve
// Tier 1 (best): $100+, Tier 2: $50+, Tier 3 (entry): $25+
const FALLBACK_TOKEN_THRESHOLDS: Record<number, number> = {
  1: 4_000_000,  // tier 1: ~$200 at $0.00005
  2: 2_000_000,  // tier 2: ~$100 at $0.00005
  3: 1_000_000,  // tier 3: ~$50 at $0.00005
};

export async function getMemberTierForWallet(
  wallet: string,
): Promise<null | number> {
  const programId = getStakingProgramId();
  if (!programId) return null;

  const trimmed = wallet?.trim();
  if (!trimmed || trimmed.length < 32) return null;

  let stakedHuman = 0;

  try {
    const token = getActiveToken();
    const connection = new Connection(getSolanaRpcUrlServer());

    const stakeData = await fetchUserStake(connection, programId, trimmed);
    if (!stakeData || stakeData.amount === 0n) return null;

    stakedHuman = Number(stakeData.amount) / 10 ** token.decimals;

    // try with market data first
    try {
      const market = await fetchTokenMarketData(token.mint);
      if (market && market.priceUsd > 0) {
        const pricing = computeTierPricing(
          token,
          market.priceUsd,
          market.marketCapUsd,
          0,
        );
        const tier = detectTierFromPricing(stakedHuman, pricing.tiers);
        if (tier != null) return tier;
      }
    } catch {
      // market data fetch failed, fall through to hardcoded thresholds
    }
  } catch (e) {
    console.error("[getMemberTierForWallet] error:", e);
    // if we at least got stakedHuman before the error, try fallback
  }

  // ALWAYS try fallback thresholds if we have any staked tokens
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[1]) return 1;
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[2]) return 2;
  if (stakedHuman >= FALLBACK_TOKEN_THRESHOLDS[3]) return 3;

  return null;
}

function detectTierFromPricing(
  stakedTokens: number,
  tiers: { tierId: number; tokensNeeded: number }[],
): null | number {
  const sorted = [...tiers].sort((a, b) => a.tierId - b.tierId);
  for (const t of sorted) {
    if (stakedTokens >= t.tokensNeeded) return t.tierId;
  }
  return null;
}

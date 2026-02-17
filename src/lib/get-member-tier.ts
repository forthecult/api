/**
 * Server-only: resolve CULT member tier (1–3) from a staking wallet.
 * Returns null if staking is not configured, wallet has no stake, or market data is unavailable.
 */

import { Connection } from "@solana/web3.js";

import { fetchUserStake, getStakingProgramId } from "~/lib/cult-staking";
import { fetchTokenMarketData } from "~/lib/market-cap";
import { computeTierPricing } from "~/lib/membership-pricing";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

export async function getMemberTierForWallet(
  wallet: string,
): Promise<null | number> {
  const programId = getStakingProgramId();
  if (!programId) return null;

  const trimmed = wallet?.trim();
  if (!trimmed || trimmed.length < 32) return null;

  try {
    const token = getActiveToken();
    const connection = new Connection(getSolanaRpcUrlServer());

    const [stakeData, market] = await Promise.all([
      fetchUserStake(connection, programId, trimmed),
      fetchTokenMarketData(token.mint),
    ]);

    if (!stakeData || stakeData.amount === 0n) return null;
    if (!market || market.priceUsd <= 0) return null;

    const stakedHuman = Number(stakeData.amount) / 10 ** token.decimals;
    const pricing = computeTierPricing(
      token,
      market.priceUsd,
      market.marketCapUsd,
      0,
    );
    return detectTierFromPricing(stakedHuman, pricing.tiers);
  } catch {
    return null;
  }
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

/**
 * Dynamic membership tier pricing engine.
 *
 * Computes the USD cost (and token quantity) for each tier based on:
 *   - Current token market cap
 *   - Number of existing stakers (bonding curve)
 *
 * CULT pricing:
 *   MC brackets: $0–$250k, $250k–$500k, $500k–$1M, MC > $1M
 *   Within each bracket, staker count determines price (bonding curve).
 *   See CULT_BRACKETS below for the full matrix.
 */

import type { TokenDef } from "./token-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingResult {
  /** The market cap bracket that was used. */
  marketCapBracket: string;
  /** Current staker count used in calculation. */
  stakerCount: number;
  /** All tier prices, ordered 3 → 1 (entry → premium). */
  tiers: TierPrice[];
  /** Token price in USD used for conversion. */
  tokenPriceUsd: number;
  /** Token symbol. */
  tokenSymbol: string;
}

export interface TierPrice {
  /** USD cost to stake for this tier. */
  costUsd: number;
  /** Tier ID (1 = best, 3 = entry). */
  tierId: number;
  /** Number of tokens needed (human-readable, e.g. 150.5). */
  tokensNeeded: number;
  /** Raw token amount (with decimals applied). */
  tokensRaw: bigint;
}

// ---------------------------------------------------------------------------
// CULT pricing (bonding curve with MC brackets and staker tiers)
// ---------------------------------------------------------------------------

/**
 * CULT pricing matrix.
 *
 * Each MC bracket has a set of staker-count ranges and USD costs per tier.
 * The staker ranges are cumulative: if 150 people have staked, we use the
 * range that 150 falls into.
 */
interface CultBracketRule {
  /** Label for this bracket. */
  label: string;
  /** MC upper bound (inclusive). Use Infinity for the last bracket. */
  mcMax: number;
  /**
   * Staker-count ranges. Ordered ascending by maxStakers.
   * Each entry: { maxStakers, costs: { tier3, tier2, tier1 } }
   */
  stakerRanges: {
    costs: Record<number, number>;
    maxStakers: number;
  }[];
}

/** Pricing by staker count only (matches "Staking cost by community size" table on membership page). */
const CULT_BRACKETS: CultBracketRule[] = [
  {
    label: "By community size",
    mcMax: Infinity,
    stakerRanges: [
      { costs: { 1: 100, 2: 50, 3: 25 }, maxStakers: 100 },
      { costs: { 1: 200, 2: 100, 3: 50 }, maxStakers: 250 },
      { costs: { 1: 400, 2: 200, 3: 100 }, maxStakers: 750 },
      { costs: { 1: 800, 2: 400, 3: 200 }, maxStakers: Infinity },
    ],
  },
];

/**
 * Compute all tier prices for CULT membership.
 *
 * @param token       Active token definition (decimals used for tokensRaw)
 * @param priceUsd    Current token price in USD
 * @param marketCapUsd Current fully-diluted market cap in USD
 * @param stakerCount Total number of current stakers (from on-chain pool)
 */
export function computeTierPricing(
  token: TokenDef,
  priceUsd: number,
  marketCapUsd: number,
  stakerCount: number,
): PricingResult {
  const result = getCultTierCosts(marketCapUsd, stakerCount);

  const tiers: TierPrice[] = [3, 2, 1].map((tierId) => {
    const costUsd = result.costs[tierId] ?? 0;
    let tokensNeeded = 0;
    let tokensRaw = 0n;

    if (priceUsd > 0) {
      tokensNeeded = costUsd / priceUsd;
      tokensRaw = BigInt(Math.floor(tokensNeeded * 10 ** token.decimals));
    }

    return { costUsd, tierId, tokensNeeded, tokensRaw };
  });

  return {
    marketCapBracket: result.label,
    stakerCount,
    tiers,
    tokenPriceUsd: priceUsd,
    tokenSymbol: "CULT",
  };
}

// ---------------------------------------------------------------------------
// Main pricing function
// ---------------------------------------------------------------------------

/**
 * Get the cost in USD for a specific tier.
 * Convenience wrapper around computeTierPricing.
 */
export function getTierCostUsd(
  _token: TokenDef,
  tierId: number,
  marketCapUsd: number,
  stakerCount: number,
): number {
  return getCultTierCosts(marketCapUsd, stakerCount).costs[tierId] ?? 0;
}

function getCultTierCosts(
  marketCapUsd: number,
  stakerCount: number,
): { costs: Record<number, number>; label: string } {
  const bracket =
    CULT_BRACKETS.find((b) => marketCapUsd <= b.mcMax) ??
    CULT_BRACKETS[CULT_BRACKETS.length - 1]!;
  const range =
    bracket.stakerRanges.find((r) => stakerCount < r.maxStakers) ??
    bracket.stakerRanges[bracket.stakerRanges.length - 1]!;
  return { costs: range.costs, label: bracket.label };
}

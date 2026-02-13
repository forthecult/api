/**
 * Dynamic membership tier pricing engine.
 *
 * Computes the USD cost (and token quantity) for each tier based on:
 *   - Current token market cap
 *   - Number of existing stakers (bonding curve — CULT only for now)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLUNA (test token) pricing:
 *   MC > $300k → $1 / $2 / $3 / $4 per tier 4/3/2/1
 *   MC ≤ $300k → $0.50 / $1 / $2 / $3 per tier 4/3/2/1
 *
 * CULT (production) pricing:
 *   MC brackets: $0–$250k, $250k–$500k, $500k–$1M
 *   Within each bracket, staker count determines price (bonding curve).
 *   See CULT_TIERS below for the full matrix.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { TokenDef } from "./token-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierPrice {
  /** Tier ID (1 = best, 4 = entry). */
  tierId: number;
  /** USD cost to stake for this tier. */
  costUsd: number;
  /** Number of tokens needed (human-readable, e.g. 150.5). */
  tokensNeeded: number;
  /** Raw token amount (with decimals applied). */
  tokensRaw: bigint;
}

export interface PricingResult {
  /** All tier prices, ordered 4 → 1 (entry → premium). */
  tiers: TierPrice[];
  /** The market cap bracket that was used. */
  marketCapBracket: string;
  /** Current staker count used in calculation. */
  stakerCount: number;
  /** Token price in USD used for conversion. */
  tokenPriceUsd: number;
  /** Token symbol. */
  tokenSymbol: string;
}

// ---------------------------------------------------------------------------
// SOLUNA pricing (simple MC threshold)
// ---------------------------------------------------------------------------

function getSolunaTierCosts(marketCapUsd: number): Record<number, number> {
  if (marketCapUsd > 300_000) {
    return { 4: 1, 3: 2, 2: 3, 1: 4 };
  }
  return { 4: 0.5, 3: 1, 2: 2, 1: 3 };
}

function getSolunaBracketLabel(marketCapUsd: number): string {
  return marketCapUsd > 300_000 ? "MC > $300k" : "MC ≤ $300k";
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
  /** MC upper bound (inclusive). Use Infinity for the last bracket. */
  mcMax: number;
  /** Label for this bracket. */
  label: string;
  /**
   * Staker-count ranges. Ordered ascending by maxStakers.
   * Each entry: { maxStakers, costs: { tier4, tier3, tier2, tier1 } }
   */
  stakerRanges: {
    maxStakers: number;
    costs: Record<number, number>;
  }[];
}

const CULT_BRACKETS: CultBracketRule[] = [
  {
    mcMax: 250_000,
    label: "MC ≤ $250k",
    stakerRanges: [
      { maxStakers: 100, costs: { 4: 25, 3: 100, 2: 200, 1: 300 } },
      { maxStakers: 200, costs: { 4: 50, 3: 200, 2: 400, 1: 600 } },
      { maxStakers: 400, costs: { 4: 100, 3: 400, 2: 800, 1: 1200 } },
      { maxStakers: Infinity, costs: { 4: 200, 3: 800, 2: 1600, 1: 2400 } },
    ],
  },
  {
    mcMax: 500_000,
    label: "$250k < MC ≤ $500k",
    stakerRanges: [
      // If only 50 people staked in the prior bracket, first 100 in this bracket
      // pay the "second range" prices from the lower bracket
      { maxStakers: 100, costs: { 4: 50, 3: 200, 2: 400, 1: 600 } },
      { maxStakers: 200, costs: { 4: 100, 3: 400, 2: 800, 1: 1200 } },
      { maxStakers: 400, costs: { 4: 200, 3: 800, 2: 1600, 1: 2400 } },
      { maxStakers: Infinity, costs: { 4: 400, 3: 1600, 2: 3200, 1: 4800 } },
    ],
  },
  {
    mcMax: 1_000_000,
    label: "$500k < MC ≤ $1M",
    stakerRanges: [
      { maxStakers: 100, costs: { 4: 100, 3: 400, 2: 800, 1: 1200 } },
      { maxStakers: 200, costs: { 4: 200, 3: 800, 2: 1600, 1: 2400 } },
      { maxStakers: Infinity, costs: { 4: 400, 3: 1600, 2: 3200, 1: 4800 } },
    ],
  },
  {
    mcMax: Infinity,
    label: "MC > $1M",
    stakerRanges: [
      { maxStakers: 100, costs: { 4: 200, 3: 800, 2: 1600, 1: 2400 } },
      { maxStakers: Infinity, costs: { 4: 400, 3: 1600, 2: 3200, 1: 4800 } },
    ],
  },
];

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

// ---------------------------------------------------------------------------
// Main pricing function
// ---------------------------------------------------------------------------

/**
 * Compute all tier prices for the active token.
 *
 * @param token       Active token definition
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
  let costs: Record<number, number>;
  let bracketLabel: string;

  if (token.key === "SOLUNA") {
    costs = getSolunaTierCosts(marketCapUsd);
    bracketLabel = getSolunaBracketLabel(marketCapUsd);
  } else {
    const result = getCultTierCosts(marketCapUsd, stakerCount);
    costs = result.costs;
    bracketLabel = result.label;
  }

  const tiers: TierPrice[] = [4, 3, 2, 1].map((tierId) => {
    const costUsd = costs[tierId] ?? 0;
    let tokensNeeded = 0;
    let tokensRaw = 0n;

    if (priceUsd > 0) {
      tokensNeeded = costUsd / priceUsd;
      tokensRaw = BigInt(Math.floor(tokensNeeded * 10 ** token.decimals));
    }

    return { tierId, costUsd, tokensNeeded, tokensRaw };
  });

  return {
    tiers,
    marketCapBracket: bracketLabel,
    stakerCount,
    tokenPriceUsd: priceUsd,
    tokenSymbol: token.symbol,
  };
}

/**
 * Get the cost in USD for a specific tier.
 * Convenience wrapper around computeTierPricing.
 */
export function getTierCostUsd(
  token: TokenDef,
  tierId: number,
  marketCapUsd: number,
  stakerCount: number,
): number {
  if (token.key === "SOLUNA") {
    return getSolunaTierCosts(marketCapUsd)[tierId] ?? 0;
  }
  return getCultTierCosts(marketCapUsd, stakerCount).costs[tierId] ?? 0;
}

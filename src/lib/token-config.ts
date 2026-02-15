/**
 * Active membership token configuration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP GUIDE (when switching from SOLUNA to CULT):
 *   1. Change ACTIVE_TOKEN below to "CULT"
 *   2. Populate the CULT pricing tiers in membership-pricing.ts
 *   3. Set CULT_TOKEN_MINT_SOLANA env var (or update the fallback in token-gate.ts)
 *   4. Redeploy the staking program initialized with the CULT mint
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Token definitions
// ---------------------------------------------------------------------------

export interface TokenDef {
  /** Number of on-chain decimals. */
  decimals: number;
  /** Unique key used across the codebase. */
  key: "CULT" | "SOLUNA";
  /** SPL token mint address on Solana. */
  mint: string;
  /** Human-readable name. */
  name: string;
  /** Ticker symbol (displayed in UI). */
  symbol: string;
}

const SOLUNA: TokenDef = {
  decimals: 6, // pump.fun tokens are 6 decimals
  key: "SOLUNA",
  mint: "2qT8JVotQ2C1gKbqpuqNatkpSBWxiKHbXkCyTqH9pump",
  name: "SOLUNA",
  symbol: "SOLUNA",
};

const CULT: TokenDef = {
  decimals: 6,
  key: "CULT",
  mint: "", // Set when launched on pump.fun
  name: "CULT",
  symbol: "CULT",
};

// ---------------------------------------------------------------------------
// Active token selector
// ---------------------------------------------------------------------------

/**
 * Change this to "CULT" when the CULT token launches on pump.fun.
 * Everything downstream reads from `getActiveToken()`.
 */
const ACTIVE_TOKEN: "CULT" | "SOLUNA" = "SOLUNA";

const TOKEN_MAP = { CULT, SOLUNA } as const;

/** Returns the currently active membership token config. */
export function getActiveToken(): TokenDef {
  // Allow env override for testing different tokens
  const envOverride = (
    typeof process.env.MEMBERSHIP_TOKEN === "string"
      ? process.env.MEMBERSHIP_TOKEN.trim()
      : ""
  ) as "" | "CULT" | "SOLUNA";
  if (envOverride && TOKEN_MAP[envOverride]) {
    return TOKEN_MAP[envOverride];
  }
  return TOKEN_MAP[ACTIVE_TOKEN];
}

/** Shorthand: active token decimals. */
export function getActiveTokenDecimals(): number {
  return getActiveToken().decimals;
}

/** Shorthand: active token mint address. */
export function getActiveTokenMint(): string {
  return getActiveToken().mint;
}

/** Shorthand: active token symbol. */
export function getActiveTokenSymbol(): string {
  return getActiveToken().symbol;
}

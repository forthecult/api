/**
 * Active membership token configuration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP GUIDE (when switching from SOLUNA to CULT):
 *   1. Change ACTIVE_TOKEN below to "CULT"
 *   2. Populate the CULT pricing tiers in membership-pricing.ts
 *   3. Set CULT_TOKEN_MINT_SOLANA env var (or update the fallback in token-gate.ts)
 *   4. Redeploy the staking program and initialize the pool with the CULT mint and Token-2022 program (CULT is already set as Token-2022 here).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Token definitions
// ---------------------------------------------------------------------------

/** Token-2022 program ID (base58). Use when the mint is a Token-2022 mint. */
export const TOKEN_2022_PROGRAM_ID_BASE58 =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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
  /**
   * Token program (base58). Omit for legacy SPL Token; set to TOKEN_2022_PROGRAM_ID_BASE58
   * for Token-2022 mints. Used by staking and any ATAs/transfers for this token.
   */
  tokenProgram?: string;
}

const SOLUNA: TokenDef = {
  decimals: 6, // pump.fun tokens are 6 decimals
  key: "SOLUNA",
  mint: "2qT8JVotQ2C1gKbqpuqNatkpSBWxiKHbXkCyTqH9pump",
  name: "SOLUNA",
  symbol: "SOLUNA",
};

/** CULT Token-2022 mint (Solana). CA: 6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump */
export const CULT_MINT_MAINNET = "6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump";

/**
 * CULT mint for swap (SOL↔CULT). Always 6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump.
 * Swap uses either the bonding curve (pre-migration) or PumpSwap pool (post-migration) for this mint.
 */
export function getCultSwapMint(): string {
  const env =
    typeof process.env.CULT_SWAP_MINT === "string"
      ? process.env.CULT_SWAP_MINT.trim()
      : "";
  return env || CULT_MINT_MAINNET;
}

const CULT: TokenDef = {
  decimals: 6,
  key: "CULT",
  mint: CULT_MINT_MAINNET,
  name: "CULT",
  symbol: "CULT",
  tokenProgram: TOKEN_2022_PROGRAM_ID_BASE58, // CULT is Token-2022
};

// ---------------------------------------------------------------------------
// Active token selector
// ---------------------------------------------------------------------------

/**
 * Active membership token. CULT mint: 6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump
 */
const ACTIVE_TOKEN: "CULT" | "SOLUNA" = "CULT";

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

/** Shorthand: active token program (base58). Undefined = legacy SPL Token. */
export function getActiveTokenProgramBase58(): string | undefined {
  return getActiveToken().tokenProgram;
}

/** Shorthand: active token symbol. */
export function getActiveTokenSymbol(): string {
  return getActiveToken().symbol;
}

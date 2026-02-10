/**
 * Solana Pay helpers for checkout. See https://github.com/solana-foundation/solana-pay
 * and https://docs.solanapay.com
 *
 * We use a unique deposit address per order so that:
 * - QR / wallet: customer pays to that address; we tie payment to order by watching it.
 * - Manual paste: customer pastes the same address and amount; we detect the transfer
 *   by watching that address. No reference needed.
 * Server derives the address deterministically from orderId + SOLANA_DEPOSIT_SECRET
 * in the create-order API; set SOLANA_DEPOSIT_SECRET (server-only) for Solana Pay checkout.
 *
 * Where do the funds go? Payments land in the per-order deposit address (not in
 * NEXT_PUBLIC_SOLANA_PAY_RECIPIENT). To get funds into your main wallet, run the
 * sweep script: `bun run scripts/sweep-solana-deposits.ts` (see that script for env vars).
 */

import BigNumber from "bignumber.js";

export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** WhiteWhale SPL (pump.fun), 6 decimals. */
export const WHITEWHALE_MINT_MAINNET =
  "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump";

/** $crust SPL (pump.fun), test token for payment flow; swap to $CULT mint when launched. */
export const CRUST_MINT_MAINNET =
  "HkBWJJiaUW5Kod4HpHWZiGD9PQVipmMiPDgiRPcNpump";

/** Pump (PUMP) SPL token on Solana. CA: pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn */
export const PUMP_MINT_MAINNET =
  "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";

/** $TROLL SPL token on Solana. CA: 5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2 */
export const TROLL_MINT_MAINNET =
  "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2";

/** CULT (Culture) SPL token on Solana. Set when contract is deployed; leave null until then. */
export const CULT_MINT_MAINNET: string | null = null;

export function getSolanaPayRecipient(): string | undefined {
  return typeof process.env.NEXT_PUBLIC_SOLANA_PAY_RECIPIENT === "string"
    ? process.env.NEXT_PUBLIC_SOLANA_PAY_RECIPIENT.trim() || undefined
    : undefined;
}

export function getSolanaPayLabel(): string {
  return typeof process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL === "string"
    ? process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL.trim()
    : "Store";
}

// ANKR Solana default (no phone required; set NEXT_PUBLIC_SOLANA_RPC_URL for paid RPC)
const ANKR_SOLANA_RPC = "https://rpc.ankr.com/solana";

// RPCs that often return 403 from browser (skip network validation to avoid console noise)
const SOLANA_RPCS_SKIP_VALIDATION = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
] as const;

/** True if we should skip the getGenesisHash network check (avoids 403 in console). */
export function isPublicSolanaRpc(url: string): boolean {
  const u = url.trim().toLowerCase();
  return SOLANA_RPCS_SKIP_VALIDATION.some((r) => u === r.toLowerCase());
}

/**
 * Get Solana RPC URL (client and server).
 * Priority: NEXT_PUBLIC_SOLANA_RPC_URL > ANKR public
 */
export function getSolanaRpcUrl(): string {
  if (typeof process.env.NEXT_PUBLIC_SOLANA_RPC_URL === "string") {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL.trim();
    if (url) return url;
  }
  return ANKR_SOLANA_RPC;
}

/** Server-side: same as getSolanaRpcUrl (single env var NEXT_PUBLIC_SOLANA_RPC_URL). */
export function getSolanaRpcUrlServer(): string {
  return getSolanaRpcUrl();
}

/**
 * USDC amount for Solana Pay: subtotal in dollars -> base units (6 decimals).
 */
export function usdcAmountFromUsd(usdAmount: number): BigNumber {
  return new BigNumber(usdAmount).times(1e6);
}

/**
 * Token amount from USD for Solana Pay (e.g. WhiteWhale). Uses 6 decimals; price feed can be wired later.
 */
export function tokenAmountFromUsd(usdAmount: number, decimals = 6): BigNumber {
  return new BigNumber(usdAmount).times(10 ** decimals);
}

/**
 * Token amount from USD when price is known as SOL per token and SOL/USD rate.
 * amountToken = amountUsd / (solPerToken * solUsdRate), in token base units.
 */
export function tokenAmountFromUsdWithPrice(
  usdAmount: number,
  solPerToken: number,
  solUsdRate: number,
  decimals: number,
): BigNumber {
  if (solPerToken <= 0 || solUsdRate <= 0) return new BigNumber(0);
  const tokenPriceUsd = solPerToken * solUsdRate;
  const tokenAmount = usdAmount / tokenPriceUsd;
  return new BigNumber(tokenAmount)
    .times(10 ** decimals)
    .integerValue(BigNumber.ROUND_CEIL);
}

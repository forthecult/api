/**
 * Compute the expected crypto amount to charge for a Solana Pay order.
 *
 * Called at order creation so the *server* locks in the threshold that the
 * confirm route will verify against. The confirm route must not accept
 * client-supplied amounts — see `/api/checkout/solana-pay/confirm/route.ts`.
 *
 * Returns a decimal string in "user units" (e.g. "0.05" for 0.05 SOL, or
 * "12345.678" for a CULT token amount). The confirm route multiplies by
 * 10^decimals when verifying on chain.
 *
 * Strategy:
 *  - USDC is USD-pegged → totalCents / 100, no price oracle needed.
 *  - Everything else uses the same server price feed as /api/crypto/prices
 *    (CoinGecko + pump.fun LPs). If no trusted price is available we return
 *    null and the caller should refuse the order for that token.
 *
 * The user may also pass the *client-displayed* amount (`clientAmount`) for
 * cross-checking. If the client value is more than `TOLERANCE` away from the
 * server value we still persist the server value (the source of truth) and
 * log the mismatch so billing / support can see if a UI price drifted.
 */

import "server-only";

import {
  getCoinGeckoSimplePrice,
  getCoinGeckoTokenPrice,
} from "~/lib/coingecko";
import { getPumpTokenPriceInSol } from "~/lib/pump-price";
import {
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  getSolanaRpcUrlServer,
  PUMP_MINT_MAINNET,
  SKR_MINT_MAINNET,
  SOLUNA_MINT_MAINNET,
  TROLL_MINT_MAINNET,
} from "~/lib/solana-pay";

export type SolanaPayToken =
  | "crust"
  | "cult"
  | "pump"
  | "seeker"
  | "solana"
  | "soluna"
  | "troll"
  | "usdc"
  | "whitewhale";

/** max acceptable divergence between client-quoted and server-computed amount. */
const TOLERANCE = 0.05; // 5% — SOL/pump.fun prices wobble on busy blocks

interface ComputeResult {
  /** how many decimal places to render; the confirm route scales by 10^decimals. */
  decimals: number;
  /**
   * amount as a decimal string in user units. never exponent notation, never
   * negative. safe to hand to BigNumber / persist to the `crypto_amount` column.
   */
  serverAmount: string;
  /** present when `clientAmount` was supplied and it is outside TOLERANCE. */
  warning?: string;
}

/**
 * Compute and lock in the expected crypto amount for a Solana Pay order.
 * Returns null when we can't price the token reliably (caller should 5xx).
 */
export async function computeExpectedSolanaCryptoAmount({
  clientAmount,
  token,
  totalCents,
}: {
  clientAmount?: null | string;
  token: SolanaPayToken;
  totalCents: number;
}): Promise<ComputeResult | null> {
  if (!Number.isFinite(totalCents) || totalCents < 0) return null;

  // usdc is usd-pegged, no oracle needed.
  if (token === "usdc") {
    return {
      decimals: 6,
      serverAmount: (totalCents / 100).toFixed(2),
    };
  }

  const usd = totalCents / 100;
  const tokenPriceUsd = await resolveTokenPriceUsd(token);
  if (tokenPriceUsd == null || tokenPriceUsd <= 0) return null;

  const amountTokens = usd / tokenPriceUsd;
  const decimals = tokenDecimals(token);
  const serverAmount = formatFixed(amountTokens, decimals);

  let warning: string | undefined;
  if (clientAmount != null && clientAmount !== "") {
    const client = Number.parseFloat(clientAmount);
    if (Number.isFinite(client) && client > 0) {
      const drift = Math.abs(client - amountTokens) / amountTokens;
      if (drift > TOLERANCE) {
        warning = `client quoted ${client} ${token}, server computed ${serverAmount} (drift ${Math.round(drift * 100)}%)`;
      }
    }
  }

  return warning
    ? { decimals, serverAmount, warning }
    : { decimals, serverAmount };
}

function formatFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  // trim trailing zeros so "0.050000000" becomes "0.05" but never to exponent form
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

async function resolveTokenPriceUsd(
  token: SolanaPayToken,
): Promise<null | number> {
  try {
    if (token === "solana") {
      const data = await getCoinGeckoSimplePrice(["solana"]);
      return data?.solana?.usd ?? null;
    }

    // pump.fun + coingecko tokens
    const mint = tokenMint(token);
    if (!mint) return null;

    // pump / skr have coingecko listings by contract; try those first so we stay
    // off the rpc when we don't have to.
    if (token === "pump" || token === "seeker") {
      const tokenPrices = await getCoinGeckoTokenPrice("solana", [mint]);
      const entry =
        tokenPrices?.[mint.toLowerCase()] ?? tokenPrices?.[mint] ?? null;
      if (entry?.usd != null && entry.usd > 0) return entry.usd;
    }

    // cult / crust / troll / soluna: derived from pump.fun LP × sol/usd.
    const solUsdMap = await getCoinGeckoSimplePrice(["solana"]);
    const solUsd = solUsdMap?.solana?.usd;
    if (!solUsd || solUsd <= 0) return null;

    const { Connection, PublicKey } = await import("@solana/web3.js");
    const connection = new Connection(getSolanaRpcUrlServer());
    const priceInSol = await getPumpTokenPriceInSol(
      connection,
      new PublicKey(mint),
    );
    if (!Number.isFinite(priceInSol) || priceInSol <= 0) return null;
    return priceInSol * solUsd;
  } catch {
    return null;
  }
}

function tokenDecimals(token: SolanaPayToken): number {
  // native sol uses 9 decimals; pump.fun tokens uniformly ship 6.
  switch (token) {
    case "solana":
      return 9;
    default:
      return 6;
  }
}

function tokenMint(token: SolanaPayToken): null | string {
  switch (token) {
    case "crust":
      return CRUST_MINT_MAINNET;
    case "cult":
      return CULT_MINT_MAINNET;
    case "pump":
      return PUMP_MINT_MAINNET;
    case "seeker":
      return SKR_MINT_MAINNET;
    case "soluna":
      return SOLUNA_MINT_MAINNET;
    case "troll":
      return TROLL_MINT_MAINNET;
    // solana (native) has no mint; usdc handled before this function is called;
    // whitewhale has no price oracle — caller should refuse.
    default:
      return null;
  }
}

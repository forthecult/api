/**
 * Pump Fun DEX price for tokens that trade against SOL on pump swap.
 * Uses @pump-fun/pump-swap-sdk; no third-party price APIs.
 */

import { type Connection, PublicKey } from "@solana/web3.js";
import {
  OnlinePumpAmmSdk,
  canonicalPumpPoolPda,
} from "@pump-fun/pump-swap-sdk";

/** Dummy user used only to fetch pool state (we only need poolBaseAmount / poolQuoteAmount). */
const DUMMY_USER = new PublicKey("11111111111111111111111111111111");

/**
 * Returns SOL per 1 token (human-readable) for a pump.fun token that has a canonical SOL pool.
 * Uses pool reserves from pump swap SDK. Returns 0 if pool not found or error.
 */
export async function getPumpTokenPriceInSol(
  connection: Connection,
  baseMint: PublicKey,
): Promise<number> {
  try {
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(baseMint);
    const state = await sdk.swapSolanaState(poolKey, DUMMY_USER);
    const { poolBaseAmount, poolQuoteAmount, baseMintAccount } = state;
    if (poolBaseAmount.isZero()) return 0;
    const baseDecimals = baseMintAccount.decimals;
    const baseDivisor = 10 ** baseDecimals;
    const solPerToken =
      poolQuoteAmount.toNumber() /
      1e9 /
      (poolBaseAmount.toNumber() / baseDivisor);
    return solPerToken;
  } catch {
    return 0;
  }
}

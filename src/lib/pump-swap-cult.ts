/**
 * Build SOL → CULT swap on PumpSwap for the stake page.
 * Uses @pump-fun/pump-swap-sdk (same as buyback-burn and pump-price).
 *
 * Two pools: there is a pool before token migration (current) and one after migration.
 * The LP will change post-migration; we use getCultSwapMint() so that when the new
 * pool is live you can set CULT_SWAP_MINT to the post-migration mint and Get CULT
 * will use the correct pool without code changes.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  buyQuoteInput,
  canonicalPumpPoolPda,
} from "@pump-fun/pump-swap-sdk";

import { getCultSwapMint } from "~/lib/token-config";

const CULT_DECIMALS = 6;

/** Slippage in percent (e.g. 1 = 1%). */
const DEFAULT_SLIPPAGE_PERCENT = 1.5;

export interface SwapSolToCultResult {
  estimatedCultRaw: string;
  transaction: Transaction;
}

/**
 * Estimate CULT (base) amount for a given SOL (quote) input.
 * Returns human-readable CULT amount string, or null if pool unavailable / error.
 */
export async function estimateCultFromSol(
  connection: Connection,
  solLamports: number,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<{ cultAmount: string; cultRaw: string } | null> {
  if (solLamports <= 0) return null;
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const dummyUser = new PublicKey(
      "11111111111111111111111111111111",
    );
    const state = await sdk.swapSolanaState(poolKey, dummyUser);
    const quoteBn = new BN(solLamports);
    const { base } = buyQuoteInput({
      quote: quoteBn,
      slippage: slippagePercent,
      baseReserve: state.poolBaseAmount,
      quoteReserve: state.poolQuoteAmount,
      baseMintAccount: state.baseMintAccount,
      baseMint: state.baseMint,
      coinCreator: state.pool.coinCreator,
      creator: state.pool.creator,
      feeConfig: state.feeConfig,
      globalConfig: state.globalConfig,
    });
    const baseNum = base.toNumber();
    const cultAmount = (baseNum / 10 ** CULT_DECIMALS).toFixed(
      CULT_DECIMALS,
    );
    return { cultAmount, cultRaw: base.toString() };
  } catch {
    return null;
  }
}

/**
 * Build a transaction that swaps SOL → CULT for the given user.
 * User must sign and send the transaction (e.g. via wallet adapter).
 */
export async function buildSwapSolToCult(
  connection: Connection,
  userPublicKey: PublicKey,
  solLamports: number,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<SwapSolToCultResult> {
  if (solLamports <= 0) {
    throw new Error("SOL amount must be positive");
  }
  const cultMint = new PublicKey(getCultSwapMint());
  const sdk = new OnlinePumpAmmSdk(connection);
  const poolKey = canonicalPumpPoolPda(cultMint);
  const swapState = await sdk.swapSolanaState(poolKey, userPublicKey);

  const quoteBn = new BN(solLamports);
  const { base } = buyQuoteInput({
    quote: quoteBn,
    slippage: slippagePercent,
    baseReserve: swapState.poolBaseAmount,
    quoteReserve: swapState.poolQuoteAmount,
    baseMintAccount: swapState.baseMintAccount,
    baseMint: swapState.baseMint,
    coinCreator: swapState.pool.coinCreator,
    creator: swapState.pool.creator,
    feeConfig: swapState.feeConfig,
    globalConfig: swapState.globalConfig,
  });

  const swapIxs = await PUMP_AMM_SDK.buyQuoteInput(
    swapState,
    quoteBn,
    slippagePercent,
  );

  const tx = new Transaction();
  tx.add(...swapIxs);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = userPublicKey;

  return {
    estimatedCultRaw: base.toString(),
    transaction: tx,
  };
}

/**
 * Build SOL ↔ CULT swap. Uses PumpSwap (AMM) when the token has migrated;
 * when the token is still on the bonding curve (pre-migration), uses the Pump
 * program buy/sell instructions so the swap works with the correct pool.
 */

import {
  buyQuoteInput,
  canonicalPumpPoolPda,
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  sellBaseInput,
} from "@pump-fun/pump-swap-sdk";
import { type Connection, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";

import {
  buildBondingBuyInstructions,
  buildBondingSellInstructions,
  estimateCultFromSolBonding,
  estimateSolFromCultBonding,
} from "~/lib/pump-bonding-cult";
import { getCultSwapMint } from "~/lib/token-config";

const CULT_DECIMALS = 6;

/** Slippage in percent (e.g. 1 = 1%). */
const DEFAULT_SLIPPAGE_PERCENT = 1.5;

export interface SwapCultToSolResult {
  estimatedSolLamports: number;
  transaction: Transaction;
}

export interface SwapSolToCultResult {
  estimatedCultRaw: string;
  transaction: Transaction;
}

/**
 * Build a transaction that swaps CULT → SOL for the given user.
 */
export async function buildSwapCultToSol(
  connection: Connection,
  userPublicKey: PublicKey,
  cultRaw: string,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<SwapCultToSolResult> {
  const baseBn = new BN(cultRaw);
  if (baseBn.lte(new BN(0))) {
    throw new Error("CULT amount must be positive");
  }
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const swapState = await sdk.swapSolanaState(poolKey, userPublicKey);

    const swapIxs = await PUMP_AMM_SDK.sellBaseInput(
      swapState,
      baseBn,
      slippagePercent,
    );

    const { uiQuote } = sellBaseInput({
      base: baseBn,
      baseMint: swapState.baseMint,
      baseMintAccount: swapState.baseMintAccount,
      baseReserve: swapState.poolBaseAmount,
      coinCreator: swapState.pool.coinCreator,
      creator: swapState.pool.creator,
      feeConfig: swapState.feeConfig,
      globalConfig: swapState.globalConfig,
      quoteReserve: swapState.poolQuoteAmount,
      slippage: slippagePercent,
    });

    const tx = new Transaction();
    tx.add(...swapIxs);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    return {
      estimatedSolLamports: uiQuote.toNumber(),
      transaction: tx,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Pool account not found") || msg.includes("not found")) {
      const { estimatedSolLamports, instructions } =
        await buildBondingSellInstructions(
          connection,
          userPublicKey,
          cultRaw,
          slippagePercent,
        );
      const tx = new Transaction();
      tx.add(...instructions);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = userPublicKey;
      return { estimatedSolLamports, transaction: tx };
    }
    throw err;
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
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const swapState = await sdk.swapSolanaState(poolKey, userPublicKey);

    const quoteBn = new BN(solLamports);
    const { base } = buyQuoteInput({
      baseMint: swapState.baseMint,
      baseMintAccount: swapState.baseMintAccount,
      baseReserve: swapState.poolBaseAmount,
      coinCreator: swapState.pool.coinCreator,
      creator: swapState.pool.creator,
      feeConfig: swapState.feeConfig,
      globalConfig: swapState.globalConfig,
      quote: quoteBn,
      quoteReserve: swapState.poolQuoteAmount,
      slippage: slippagePercent,
    });

    const swapIxs = await PUMP_AMM_SDK.buyQuoteInput(
      swapState,
      quoteBn,
      slippagePercent,
    );

    const tx = new Transaction();
    tx.add(...swapIxs);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    return {
      estimatedCultRaw: base.toString(),
      transaction: tx,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Pool account not found") || msg.includes("not found")) {
      const { estimatedCultRaw, instructions } =
        await buildBondingBuyInstructions(
          connection,
          userPublicKey,
          solLamports,
          slippagePercent,
        );
      const tx = new Transaction();
      tx.add(...instructions);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = userPublicKey;
      return { estimatedCultRaw, transaction: tx };
    }
    throw err;
  }
}

/**
 * Estimate CULT (base) amount for a given SOL (quote) input.
 * Returns human-readable CULT amount string, or null if pool unavailable / error.
 */
export async function estimateCultFromSol(
  connection: Connection,
  solLamports: number,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<null | { cultAmount: string; cultRaw: string }> {
  if (solLamports <= 0) return null;
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const dummyUser = new PublicKey("11111111111111111111111111111111");
    const state = await sdk.swapSolanaState(poolKey, dummyUser);
    const quoteBn = new BN(solLamports);
    const { base } = buyQuoteInput({
      baseMint: state.baseMint,
      baseMintAccount: state.baseMintAccount,
      baseReserve: state.poolBaseAmount,
      coinCreator: state.pool.coinCreator,
      creator: state.pool.creator,
      feeConfig: state.feeConfig,
      globalConfig: state.globalConfig,
      quote: quoteBn,
      quoteReserve: state.poolQuoteAmount,
      slippage: slippagePercent,
    });
    const baseNum = base.toNumber();
    const cultAmount = (baseNum / 10 ** CULT_DECIMALS).toFixed(CULT_DECIMALS);
    return { cultAmount, cultRaw: base.toString() };
  } catch {
    return estimateCultFromSolBonding(connection, solLamports, slippagePercent);
  }
}

/**
 * Estimate SOL (quote) amount for selling a given CULT (base) amount.
 */
export async function estimateSolFromCult(
  connection: Connection,
  cultRaw: string,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<null | { solAmount: string; solLamports: number }> {
  const baseBn = new BN(cultRaw);
  if (baseBn.lte(new BN(0))) return null;
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const dummyUser = new PublicKey("11111111111111111111111111111111");
    const state = await sdk.swapSolanaState(poolKey, dummyUser);
    const { uiQuote } = sellBaseInput({
      base: baseBn,
      baseMint: state.baseMint,
      baseMintAccount: state.baseMintAccount,
      baseReserve: state.poolBaseAmount,
      coinCreator: state.pool.coinCreator,
      creator: state.pool.creator,
      feeConfig: state.feeConfig,
      globalConfig: state.globalConfig,
      quoteReserve: state.poolQuoteAmount,
      slippage: slippagePercent,
    });
    const solLamports = uiQuote.toNumber();
    const solAmount = (solLamports / 1e9).toFixed(9);
    return { solAmount, solLamports };
  } catch {
    return estimateSolFromCultBonding(connection, cultRaw, slippagePercent);
  }
}

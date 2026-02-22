/**
 * Build SOL ↔ CULT swap. Uses PumpSwap (AMM) when the token has migrated;
 * when the token is still on the bonding curve (pre-migration), uses the Pump
 * program buy/sell instructions so the swap works with the correct pool.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  buyQuoteInput,
  canonicalPumpPoolPda,
  sellBaseInput,
} from "@pump-fun/pump-swap-sdk";

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
    return estimateCultFromSolBonding(connection, solLamports, slippagePercent);
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

    const { blockhash } =
      await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    return {
      estimatedCultRaw: base.toString(),
      transaction: tx,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Pool account not found") || msg.includes("not found")) {
      const { instructions, estimatedCultRaw } =
        await buildBondingBuyInstructions(
          connection,
          userPublicKey,
          solLamports,
          slippagePercent,
        );
      const tx = new Transaction();
      tx.add(...instructions);
      const { blockhash } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = userPublicKey;
      return { estimatedCultRaw, transaction: tx };
    }
    throw err;
  }
}

export interface SwapCultToSolResult {
  estimatedSolLamports: number;
  transaction: Transaction;
}

/**
 * Estimate SOL (quote) amount for selling a given CULT (base) amount.
 */
export async function estimateSolFromCult(
  connection: Connection,
  cultRaw: string,
  slippagePercent: number = DEFAULT_SLIPPAGE_PERCENT,
): Promise<{ solLamports: number; solAmount: string } | null> {
  const baseBn = new BN(cultRaw);
  if (baseBn.lte(new BN(0))) return null;
  try {
    const cultMint = new PublicKey(getCultSwapMint());
    const sdk = new OnlinePumpAmmSdk(connection);
    const poolKey = canonicalPumpPoolPda(cultMint);
    const dummyUser = new PublicKey(
      "11111111111111111111111111111111",
    );
    const state = await sdk.swapSolanaState(poolKey, dummyUser);
    const { uiQuote } = sellBaseInput({
      base: baseBn,
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
    const solLamports = uiQuote.toNumber();
    const solAmount = (solLamports / 1e9).toFixed(9);
    return { solLamports, solAmount };
  } catch {
    return estimateSolFromCultBonding(connection, cultRaw, slippagePercent);
  }
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
      const { instructions, estimatedSolLamports } =
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

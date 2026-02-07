/**
 * Buyback & burn: use the fee wallet’s SOL to buy CULT on the pump pool and burn it.
 *
 * Required env:
 *   BUYBACK_WALLET_SECRET_KEY  – base58 private key or JSON array string
 *   CULT_TOKEN_MINT_SOLANA     – CULT mint address
 *   SOLANA_RPC_URL             – RPC endpoint (optional if default)
 *
 * Optional env:
 *   BUYBACK_MIN_SOL            – only run if balance >= this (default 0.05)
 *   BUYBACK_SOL_RESERVE        – SOL to leave in wallet (default 0.01)
 *   BUYBACK_SLIPPAGE_BPS       – slippage in basis points (default 100 = 1%)
 *   DRY_RUN=true               – log only, do not send tx
 *
 * Run: bun run scripts/buyback-burn.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createBurnInstruction } from "@solana/spl-token";
import BN from "bn.js";
import bs58 from "bs58";
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  canonicalPumpPoolPda,
  buyQuoteInput,
} from "@pump-fun/pump-swap-sdk";

const LAMPORTS_PER_SOL = 1e9;

function getKeypair(): Keypair {
  const raw = process.env.BUYBACK_WALLET_SECRET_KEY;
  if (!raw?.trim()) {
    throw new Error("Missing BUYBACK_WALLET_SECRET_KEY");
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

function parseNumEnv(name: string, defaultVal: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultVal;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return defaultVal;
  return n;
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const rpc = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const mintStr = process.env.CULT_TOKEN_MINT_SOLANA?.trim();
  if (!mintStr) {
    throw new Error("Missing CULT_TOKEN_MINT_SOLANA");
  }

  const minSol = parseNumEnv("BUYBACK_MIN_SOL", 0.05);
  const reserveSol = parseNumEnv("BUYBACK_SOL_RESERVE", 0.01);
  const slippageBps = parseNumEnv("BUYBACK_SLIPPAGE_BPS", 100);
  const slippagePercent = slippageBps / 100; // 100 bps => 1%

  const connection = new Connection(rpc);
  const wallet = getKeypair();
  const cultMint = new PublicKey(mintStr);

  const balance = await connection.getBalance(wallet.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`Wallet ${wallet.publicKey.toBase58()} SOL balance: ${balanceSol.toFixed(4)}`);

  const reserveLamports = Math.ceil(reserveSol * LAMPORTS_PER_SOL);
  const minLamports = Math.ceil(minSol * LAMPORTS_PER_SOL);
  if (balance < minLamports) {
    console.log(`Balance below minimum ${minSol} SOL. Skipping.`);
    return;
  }

  const quoteLamports = balance - reserveLamports;
  if (quoteLamports <= 0) {
    console.log("No SOL left after reserve. Skipping.");
    return;
  }
  const quoteBn = new BN(quoteLamports);
  console.log(`Will swap ~${(quoteLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (reserving ${reserveSol} SOL)`);

  const sdk = new OnlinePumpAmmSdk(connection);
  const poolKey = canonicalPumpPoolPda(cultMint);
  const swapState = await sdk.swapSolanaState(poolKey, wallet.publicKey);

  const {
    poolBaseAmount,
    poolQuoteAmount,
    baseMintAccount,
    baseMint,
    userBaseTokenAccount,
    baseTokenProgram,
  } = swapState;
  const { coinCreator, creator } = swapState.pool;

  const { base: baseAmount } = buyQuoteInput({
    quote: quoteBn,
    slippage: slippagePercent,
    baseReserve: poolBaseAmount,
    quoteReserve: poolQuoteAmount,
    baseMintAccount,
    baseMint,
    coinCreator,
    creator,
    feeConfig: swapState.feeConfig,
    globalConfig: swapState.globalConfig,
  });

  if (baseAmount.isZero()) {
    console.log("Computed base amount is zero. Skipping.");
    return;
  }

  const swapIxs = await PUMP_AMM_SDK.buyQuoteInput(
    swapState,
    quoteBn,
    slippagePercent,
  );

  const burnIx = createBurnInstruction(
    userBaseTokenAccount,
    cultMint,
    wallet.publicKey,
    BigInt(baseAmount.toString()), // amount in token's smallest unit
    [],
    baseTokenProgram,
  );

  const tx = new Transaction();
  tx.add(...swapIxs, burnIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  if (dryRun) {
    console.log("[DRY RUN] Would send tx: swap", quoteLamports, "lamports -> CULT, then burn", baseAmount.toString(), "base units.");
    return;
  }

  const sig = await connection.sendTransaction(tx, [wallet], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  console.log("Tx sent:", sig);

  const confirm = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (confirm.value.err) {
    throw new Error(`Tx failed: ${JSON.stringify(confirm.value.err)}`);
  }
  console.log("Confirmed. Buyback and burn done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

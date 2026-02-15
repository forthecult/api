/**
 * Distribute SOL to stakers proportionally to their staked CULT balance.
 *
 * Required env:
 *   STAKING_REWARDS_WALLET_SECRET_KEY  – base58 private key or JSON array (payer)
 *   CULT_STAKING_PROGRAM_ID            – staking program ID
 *
 * Optional env:
 *   REWARD_SOL_TOTAL                   – total SOL to distribute this run (e.g. "0.5")
 *   REWARD_SOL_PER_RUN                 – alias for REWARD_SOL_TOTAL
 *   MIN_STAKER_LAMPORTS                – skip stakers whose share is below this (default 1000 = 0.000001 SOL)
 *   SOLANA_RPC_URL                     – RPC (default mainnet)
 *   DRY_RUN=true                       – log only, do not send txs
 *   BATCH_SIZE                         – transfers per transaction (default 8)
 *
 * Run: bun run scripts/staking-rewards-distribute.ts
 *
 * Cron example (weekly): 0 0 * * 0 cd /path/to/ftc && REWARD_SOL_TOTAL=0.5 bun run scripts/staking-rewards-distribute.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";

import {
  fetchAllStakers,
  getStakingProgramId,
} from "~/lib/cult-staking";

function getKeypair(): Keypair {
  const raw = process.env.STAKING_REWARDS_WALLET_SECRET_KEY;
  if (!raw?.trim()) {
    throw new Error("Missing STAKING_REWARDS_WALLET_SECRET_KEY");
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
  const rewardSol =
    parseNumEnv("REWARD_SOL_TOTAL", 0) || parseNumEnv("REWARD_SOL_PER_RUN", 0);
  const minLamports = parseNumEnv("MIN_STAKER_LAMPORTS", 1000);
  const batchSize = Math.max(1, Math.min(32, parseNumEnv("BATCH_SIZE", 8)));

  const programId = getStakingProgramId();
  if (!programId) {
    throw new Error("Missing CULT_STAKING_PROGRAM_ID");
  }
  if (rewardSol <= 0) {
    console.log("Set REWARD_SOL_TOTAL (e.g. 0.5) to distribute. Exiting.");
    return;
  }

  const connection = new Connection(rpc);
  const wallet = getKeypair();
  const balance = await connection.getBalance(wallet.publicKey);
  const rewardLamports = BigInt(Math.floor(rewardSol * LAMPORTS_PER_SOL));
  if (balance < Number(rewardLamports)) {
    throw new Error(
      `Insufficient balance: have ${balance / LAMPORTS_PER_SOL} SOL, need ${rewardSol} SOL`,
    );
  }

  const stakers = await fetchAllStakers(connection, programId);
  const totalStaked = stakers.reduce((s, e) => s + e.amount, 0n);
  if (totalStaked === 0n) {
    console.log("No stakers. Exiting.");
    return;
  }

  const decimals = 1e6; // CULT decimals
  console.log(
    `Stakers: ${stakers.length}, total staked (raw): ${totalStaked}, reward: ${rewardSol} SOL`,
  );

  type Payout = { to: string; lamports: bigint };
  const payouts: Payout[] = [];
  for (const { owner, amount } of stakers) {
    const share = (amount * rewardLamports) / totalStaked;
    if (share < BigInt(minLamports)) continue;
    payouts.push({ to: owner, lamports: share });
  }

  if (payouts.length === 0) {
    console.log("No payouts above minimum. Exiting.");
    return;
  }

  console.log(`Payouts: ${payouts.length}`);
  if (dryRun) {
    let total = 0n;
    for (const p of payouts) {
      total += p.lamports;
      console.log(`  ${p.to}: ${Number(p.lamports) / LAMPORTS_PER_SOL} SOL`);
    }
    console.log(`  Total would send: ${Number(total) / LAMPORTS_PER_SOL} SOL (DRY RUN)`);
    return;
  }

  const batches: Payout[][] = [];
  for (let i = 0; i < payouts.length; i += batchSize) {
    batches.push(payouts.slice(i, i + batchSize));
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]!;
    const tx = new Transaction();
    for (const { to, lamports } of batch) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(to),
          lamports: Number(lamports),
        }),
      );
    }
    const sig = await connection.sendTransaction(tx, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    console.log(`Batch ${b + 1}/${batches.length} tx: ${sig}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

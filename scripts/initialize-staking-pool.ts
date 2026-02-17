#!/usr/bin/env bun
/**
 * One-time: initialize the CULT staking pool after deploy.
 * Creates the pool PDA and vault ATA; the signer becomes the pool authority (can pause staking).
 *
 * Required env:
 *   CULT_STAKING_PROGRAM_ID   – deployed program ID
 *   CULT_TOKEN_MINT_SOLANA    – CULT mint (Token-2022)
 *
 * Authority (payer): one of
 *   STAKING_INIT_AUTHORITY_KEYPAIR  – base58 secret key or JSON array (recommended for automation)
 *   Or no env: reads ~/.config/solana/id.json (same as Anchor wallet)
 *
 * Optional:
 *   SOLANA_RPC_URL  – RPC (default: devnet)
 *   DRY_RUN=true    – build and log tx, do not send
 *
 * Run from webapp: bun run scripts/initialize-staking-pool.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import { buildInitializeTransaction } from "~/lib/cult-staking-instructions";
import {
  getPoolPda,
  getStakingProgramId,
  getVaultAta,
} from "~/lib/cult-staking";
import { TOKEN_2022_PROGRAM_ID_BASE58 } from "~/lib/token-config";

function getAuthorityKeypair(): Keypair {
  const raw = process.env.STAKING_INIT_AUTHORITY_KEYPAIR?.trim();
  if (raw) {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const path = resolve(home, ".config/solana/id.json");
  const json = readFileSync(path, "utf8");
  const arr = JSON.parse(json) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const rpc =
    process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";

  const programId = getStakingProgramId();
  if (!programId) {
    throw new Error("Missing CULT_STAKING_PROGRAM_ID");
  }

  const mintStr = process.env.CULT_TOKEN_MINT_SOLANA?.trim();
  if (!mintStr) {
    throw new Error("Missing CULT_TOKEN_MINT_SOLANA");
  }
  const mint = new PublicKey(mintStr);
  const tokenProgram = new PublicKey(TOKEN_2022_PROGRAM_ID_BASE58);

  const authority = getAuthorityKeypair();
  const connection = new Connection(rpc);

  const [poolPda] = getPoolPda(programId);
  const vault = getVaultAta(mint, poolPda, tokenProgram);

  console.log("Program ID:", programId.toBase58());
  console.log("Mint (CULT):", mint.toBase58());
  console.log("Authority:", authority.publicKey.toBase58());
  console.log("Pool PDA:", poolPda.toBase58());
  console.log("Vault ATA:", vault.toBase58());

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = buildInitializeTransaction({
    authority: authority.publicKey,
    blockhash,
    lastValidBlockHeight,
    mint,
    programId,
    tokenProgram,
  });

  if (dryRun) {
    console.log("\n[DRY_RUN] Transaction built. Set DRY_RUN=false or unset to send.");
    return;
  }

  const sig = await sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: "confirmed",
    maxRetries: 5,
    preflightCommitment: "confirmed",
  });
  console.log("\nInitialized. Signature:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

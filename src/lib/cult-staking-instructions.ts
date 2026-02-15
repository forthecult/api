/**
 * Server-only: Anchor instruction discriminators and transaction builders.
 * Uses node:crypto for sighash — do not import this from client components.
 */

import { createHash } from "node:crypto";
import {
  type PublicKey as PublicKeyClass,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  getPoolPda,
  getUserStakePda,
  getVaultAta,
  isValidLockDuration,
  type LockDuration,
} from "~/lib/cult-staking";

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

function anchorSighash(ixName: string): Buffer {
  const h = createHash("sha256").update(`global:${ixName}`).digest();
  return Buffer.from(h.slice(0, 8));
}

const STAKE_IX_DISCRIMINATOR = anchorSighash("stake");
const UNSTAKE_IX_DISCRIMINATOR = anchorSighash("unstake");

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

export function buildStakeInstruction(params: {
  programId: PublicKeyClass;
  poolPda: PublicKeyClass;
  mint: PublicKeyClass;
  vault: PublicKeyClass;
  owner: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  userStakePda: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  amount: bigint;
  lockDuration: LockDuration;
}): TransactionInstruction {
  const {
    programId,
    poolPda,
    mint,
    vault,
    owner,
    userTokenAccount,
    userStakePda,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = params;
  if (params.amount <= 0n) throw new Error("Stake amount must be positive");
  if (!isValidLockDuration(params.lockDuration))
    throw new Error("Invalid lock duration");

  const data = Buffer.alloc(24);
  STAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.amount, 8);
  data.writeBigUInt64LE(BigInt(params.lockDuration), 16);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userStakePda, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildUnstakeInstruction(params: {
  programId: PublicKeyClass;
  poolPda: PublicKeyClass;
  mint: PublicKeyClass;
  vault: PublicKeyClass;
  owner: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  userStakePda: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  amount: bigint;
}): TransactionInstruction {
  const {
    programId,
    poolPda,
    mint,
    vault,
    owner,
    userTokenAccount,
    userStakePda,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = params;
  if (params.amount <= 0n) throw new Error("Unstake amount must be positive");

  const data = Buffer.alloc(16);
  UNSTAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userStakePda, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

export function buildStakeTransaction(params: {
  programId: PublicKeyClass;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  amount: bigint;
  lockDuration: LockDuration;
  tokenProgram?: PublicKeyClass;
  blockhash: string;
  lastValidBlockHeight: number;
}): Transaction {
  const programId = params.programId;
  if (!programId) throw new Error("Staking program ID not set");
  const mint = params.mint;
  const owner = params.owner;
  const [poolPda] = getPoolPda(programId);
  const vault = getVaultAta(mint, poolPda, params.tokenProgram);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    params.tokenProgram ?? TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [userStakePda] = getUserStakePda(programId, poolPda, owner);

  const ix = buildStakeInstruction({
    programId,
    poolPda,
    mint,
    vault,
    owner,
    userTokenAccount,
    userStakePda,
    tokenProgram: params.tokenProgram,
    amount: params.amount,
    lockDuration: params.lockDuration,
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(ix);
  return tx;
}

export function buildUnstakeTransaction(params: {
  programId: PublicKeyClass;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  amount: bigint;
  tokenProgram?: PublicKeyClass;
  blockhash: string;
  lastValidBlockHeight: number;
}): Transaction {
  const programId = params.programId;
  const mint = params.mint;
  const owner = params.owner;
  const [poolPda] = getPoolPda(programId);
  const vault = getVaultAta(mint, poolPda, params.tokenProgram);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    params.tokenProgram ?? TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [userStakePda] = getUserStakePda(programId, poolPda, owner);

  const ix = buildUnstakeInstruction({
    programId,
    poolPda,
    mint,
    vault,
    owner,
    userTokenAccount,
    userStakePda,
    tokenProgram: params.tokenProgram,
    amount: params.amount,
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(ix);
  return tx;
}

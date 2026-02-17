/**
 * Server-only: Anchor instruction discriminators and transaction builders.
 * Uses node:crypto for sighash — do not import this from client components.
 */

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  type PublicKey as PublicKeyClass,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

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

const INITIALIZE_IX_DISCRIMINATOR = anchorSighash("initialize");
const STAKE_IX_DISCRIMINATOR = anchorSighash("stake");
const UNSTAKE_IX_DISCRIMINATOR = anchorSighash("unstake");

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

export function buildInitializeInstruction(params: {
  authority: PublicKeyClass;
  mint: PublicKeyClass;
  poolPda: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  vault: PublicKeyClass;
}): TransactionInstruction {
  const {
    authority,
    mint,
    poolPda,
    programId,
    tokenProgram = TOKEN_PROGRAM_ID,
    vault,
  } = params;

  return new TransactionInstruction({
    data: Buffer.from(INITIALIZE_IX_DISCRIMINATOR),
    keys: [
      { isSigner: true, isWritable: true, pubkey: authority },
      { isSigner: false, isWritable: true, pubkey: poolPda },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: vault },
      { isSigner: false, isWritable: false, pubkey: tokenProgram },
      { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId,
  });
}

export function buildStakeInstruction(params: {
  amount: bigint;
  lockDuration: LockDuration;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  poolPda: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  userStakePda: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  vault: PublicKeyClass;
}): TransactionInstruction {
  const {
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram = TOKEN_PROGRAM_ID,
    userStakePda,
    userTokenAccount,
    vault,
  } = params;
  if (params.amount <= 0n) throw new Error("Stake amount must be positive");
  if (!isValidLockDuration(params.lockDuration))
    throw new Error("Invalid lock duration");

  const data = Buffer.alloc(24);
  STAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.amount, 8);
  data.writeBigUInt64LE(BigInt(params.lockDuration), 16);

  return new TransactionInstruction({
    data,
    keys: [
      { isSigner: true, isWritable: true, pubkey: owner },
      { isSigner: false, isWritable: true, pubkey: poolPda },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: vault },
      { isSigner: false, isWritable: true, pubkey: userTokenAccount },
      { isSigner: false, isWritable: true, pubkey: userStakePda },
      { isSigner: false, isWritable: false, pubkey: tokenProgram },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId,
  });
}

export function buildStakeTransaction(params: {
  amount: bigint;
  blockhash: string;
  lastValidBlockHeight: number;
  lockDuration: LockDuration;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
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
    amount: params.amount,
    lockDuration: params.lockDuration,
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram: params.tokenProgram,
    userStakePda,
    userTokenAccount,
    vault,
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(ix);
  return tx;
}

export function buildInitializeTransaction(params: {
  authority: PublicKeyClass;
  blockhash: string;
  lastValidBlockHeight: number;
  mint: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
}): Transaction {
  const [poolPda] = getPoolPda(params.programId);
  const vault = getVaultAta(
    params.mint,
    poolPda,
    params.tokenProgram ?? TOKEN_PROGRAM_ID,
  );
  const ix = buildInitializeInstruction({
    authority: params.authority,
    mint: params.mint,
    poolPda,
    programId: params.programId,
    tokenProgram: params.tokenProgram,
    vault,
  });
  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = params.authority;
  tx.add(ix);
  return tx;
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

export function buildUnstakeInstruction(params: {
  amount: bigint;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  poolPda: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  userStakePda: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  vault: PublicKeyClass;
}): TransactionInstruction {
  const {
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram = TOKEN_PROGRAM_ID,
    userStakePda,
    userTokenAccount,
    vault,
  } = params;
  if (params.amount <= 0n) throw new Error("Unstake amount must be positive");

  const data = Buffer.alloc(16);
  UNSTAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.amount, 8);

  return new TransactionInstruction({
    data,
    keys: [
      { isSigner: true, isWritable: true, pubkey: owner },
      { isSigner: false, isWritable: true, pubkey: poolPda },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: vault },
      { isSigner: false, isWritable: true, pubkey: userTokenAccount },
      { isSigner: false, isWritable: true, pubkey: userStakePda },
      { isSigner: false, isWritable: false, pubkey: tokenProgram },
    ],
    programId,
  });
}

export function buildUnstakeTransaction(params: {
  amount: bigint;
  blockhash: string;
  lastValidBlockHeight: number;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
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
    amount: params.amount,
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram: params.tokenProgram,
    userStakePda,
    userTokenAccount,
    vault,
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(ix);
  return tx;
}

/**
 * Build a single transaction that unstakes then re-stakes the same amount with a new lock.
 * Use when the lock has expired: user signs once to "restake" (lock for another 30 days or 12 months).
 */
export function buildRestakeTransaction(params: {
  amount: bigint;
  blockhash: string;
  lastValidBlockHeight: number;
  lockDuration: LockDuration;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
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
  const tokenProgram = params.tokenProgram ?? TOKEN_PROGRAM_ID;

  const unstakeIx = buildUnstakeInstruction({
    amount: params.amount,
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram,
    userStakePda,
    userTokenAccount,
    vault,
  });
  const stakeIx = buildStakeInstruction({
    amount: params.amount,
    lockDuration: params.lockDuration,
    mint,
    owner,
    poolPda,
    programId,
    tokenProgram,
    userStakePda,
    userTokenAccount,
    vault,
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(unstakeIx, stakeIx);
  return tx;
}

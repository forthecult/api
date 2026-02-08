/**
 * CULT on-chain staking program helpers.
 * Program: programs/cult_staking (Anchor). Pool PDA holds vault; user stake PDAs hold amount.
 */

import { createHash } from "node:crypto";
import {
  type Connection,
  type PublicKey,
  PublicKey as PublicKeyClass,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

const STAKE_POOL_SEED = Buffer.from("pool");
const USER_STAKE_SEED = Buffer.from("stake");

/** Anchor instruction discriminator = first 8 bytes of sha256("global:<ix_name>") */
function anchorSighash(ixName: string): Buffer {
  const h = createHash("sha256")
    .update(`global:${ixName}`)
    .digest();
  return Buffer.from(h.slice(0, 8));
}

const STAKE_IX_DISCRIMINATOR = anchorSighash("stake");
const UNSTAKE_IX_DISCRIMINATOR = anchorSighash("unstake");

/** Staking program ID. Set CULT_STAKING_PROGRAM_ID (server) / NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID (client). Returns null if not set (staking disabled). */
export function getStakingProgramId(): PublicKeyClass | null {
  const id =
    typeof process.env.CULT_STAKING_PROGRAM_ID === "string"
      ? process.env.CULT_STAKING_PROGRAM_ID.trim()
      : typeof process.env.NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID === "string"
        ? process.env.NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID.trim()
        : "";
  if (!id) return null;
  return new PublicKeyClass(id);
}

/** Pool PDA: seeds = ["pool"] */
export function getPoolPda(programId: PublicKeyClass): [PublicKeyClass, number] {
  return PublicKeyClass.findProgramAddressSync(
    [STAKE_POOL_SEED],
    programId,
  );
}

/** User stake PDA: seeds = ["stake", pool.key(), user.key()] */
export function getUserStakePda(
  programId: PublicKeyClass,
  poolPda: PublicKeyClass,
  user: PublicKeyClass,
): [PublicKeyClass, number] {
  return PublicKeyClass.findProgramAddressSync(
    [USER_STAKE_SEED, poolPda.toBuffer(), user.toBuffer()],
    programId,
  );
}

/** UserStake account layout: 8 (discriminator) + 32 (owner) + 8 (amount) */
const USER_STAKE_AMOUNT_OFFSET = 8 + 32;

/** Fetch staked amount (raw, with decimals) for a wallet. Returns 0n if no stake account, program not deployed, or program ID not set. */
export async function fetchStakedBalance(
  connection: Connection,
  programId: PublicKeyClass | null,
  walletAddress: string | PublicKeyClass,
): Promise<bigint> {
  if (!programId) return 0n;
  try {
    const [poolPda] = getPoolPda(programId);
    const user = typeof walletAddress === "string" ? new PublicKeyClass(walletAddress) : walletAddress;
    const [userStakePda] = getUserStakePda(programId, poolPda, user);
    const account = await connection.getAccountInfo(userStakePda);
    if (!account || account.data.length < USER_STAKE_AMOUNT_OFFSET + 8)
      return 0n;
    const amount = account.data.readBigUInt64LE(USER_STAKE_AMOUNT_OFFSET);
    return amount;
  } catch {
    return 0n;
  }
}

/** Build stake instruction. Call from server (uses Node crypto for discriminator). */
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
  const amount = params.amount;
  if (amount <= 0n) throw new Error("Stake amount must be positive");

  const data = Buffer.alloc(8 + 8);
  STAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: false },
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

/** Build unstake instruction. */
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
  const amount = params.amount;
  if (amount <= 0n) throw new Error("Unstake amount must be positive");

  const data = Buffer.alloc(8 + 8);
  UNSTAKE_IX_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userStakePda, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Get vault ATA address: vault = ATA(mint, poolPda). */
export function getVaultAta(
  mint: PublicKeyClass,
  poolPda: PublicKeyClass,
  tokenProgram: PublicKeyClass = TOKEN_PROGRAM_ID,
): PublicKeyClass {
  return getAssociatedTokenAddressSync(
    mint,
    poolPda,
    true, // allowOwnerOffCurve for PDA
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/**
 * Build a stake transaction (instruction only). Used by API to return a tx for client to sign and send.
 */
export function buildStakeTransaction(params: {
  programId: PublicKeyClass;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  amount: bigint;
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
  });

  const tx = new Transaction();
  tx.recentBlockhash = params.blockhash;
  tx.lastValidBlockHeight = params.lastValidBlockHeight;
  tx.feePayer = owner;
  tx.add(ix);
  return tx;
}

/**
 * Build an unstake transaction.
 */
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

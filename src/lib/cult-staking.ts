/**
 * CULT on-chain staking program helpers.
 *
 * Program: programs/cult_staking (Anchor 0.30).
 * Pool PDA holds vault; user stake PDAs hold amount + lock metadata.
 *
 * Lock durations:
 *   - 30 days  = 2_592_000 seconds
 *   - 12 months = 31_536_000 seconds (365 days)
 *
 * Note: Instruction/transaction builders (buildStakeTransaction, etc.) live in
 * cult-staking-instructions.ts (server-only, uses node:crypto). Do not import
 * that file from client components.
 */

import { type Connection, PublicKey as PublicKeyClass } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAKE_POOL_SEED = Buffer.from("pool");
const USER_STAKE_SEED = Buffer.from("stake");

/** 30 days in seconds. */
export const LOCK_30_DAYS = 2_592_000;
/** 365 days in seconds (12 months). */
export const LOCK_12_MONTHS = 31_536_000;

export type LockDuration = typeof LOCK_30_DAYS | typeof LOCK_12_MONTHS;

/** Validate that a duration is one of the two allowed values. */
export function isValidLockDuration(d: number): d is LockDuration {
  return d === LOCK_30_DAYS || d === LOCK_12_MONTHS;
}

/** Human-readable label for a lock duration. */
export function lockDurationLabel(d: number): string {
  if (d === LOCK_30_DAYS) return "30 days";
  if (d === LOCK_12_MONTHS) return "12 months";
  return `${d}s`;
}

// ---------------------------------------------------------------------------
// Program ID & PDAs
// ---------------------------------------------------------------------------

/**
 * Staking program ID.
 * Set CULT_STAKING_PROGRAM_ID (server) / NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID (client).
 * Returns null if not set (staking disabled).
 */
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
export function getPoolPda(
  programId: PublicKeyClass,
): [PublicKeyClass, number] {
  return PublicKeyClass.findProgramAddressSync([STAKE_POOL_SEED], programId);
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

// ---------------------------------------------------------------------------
// Account layout: UserStake
//   8  discriminator
//  32  owner      (Pubkey)
//   8  amount     (u64)
//   8  staked_at  (i64)
//   8  lock_duration (u64)
//   8  locked_until  (i64)
// = 72 bytes total
// ---------------------------------------------------------------------------

const USER_STAKE_DISCRIMINATOR_LEN = 8;
const USER_STAKE_OWNER_OFFSET = USER_STAKE_DISCRIMINATOR_LEN; // 8
const USER_STAKE_AMOUNT_OFFSET = USER_STAKE_OWNER_OFFSET + 32; // 40
const USER_STAKE_STAKED_AT_OFFSET = USER_STAKE_AMOUNT_OFFSET + 8; // 48
const USER_STAKE_LOCK_DURATION_OFFSET = USER_STAKE_STAKED_AT_OFFSET + 8; // 56
const USER_STAKE_LOCKED_UNTIL_OFFSET = USER_STAKE_LOCK_DURATION_OFFSET + 8; // 64
const USER_STAKE_ACCOUNT_SIZE = 72;

// ---------------------------------------------------------------------------
// Account layout: StakePool
//   8  discriminator
//  32  mint            (Pubkey)
//  32  vault           (Pubkey)
//   1  bump            (u8)
//   8  total_stakers   (u64)
//   8  total_staked    (u64)
// = 89 bytes total
// ---------------------------------------------------------------------------

const POOL_TOTAL_STAKERS_OFFSET = 8 + 32 + 32 + 1; // 73
const POOL_TOTAL_STAKED_OFFSET = POOL_TOTAL_STAKERS_OFFSET + 8; // 81
const POOL_ACCOUNT_SIZE = 89;

// ---------------------------------------------------------------------------
// Parsed types
// ---------------------------------------------------------------------------

export type ParsedUserStake = {
  owner: string;
  amount: bigint;
  stakedAt: number; // Unix timestamp (seconds)
  lockDuration: number; // seconds
  lockedUntil: number; // Unix timestamp (seconds)
};

export type ParsedStakePool = {
  mint: string;
  vault: string;
  bump: number;
  totalStakers: number;
  totalStaked: bigint;
};

export type StakerEntry = {
  owner: string;
  amount: bigint;
  stakedAt: number;
  lockDuration: number;
  lockedUntil: number;
};

// ---------------------------------------------------------------------------
// Account parsing
// ---------------------------------------------------------------------------

/** Parse a UserStake account's data buffer. Returns null if data is too small. */
export function parseUserStake(data: Buffer): ParsedUserStake | null {
  if (data.length < USER_STAKE_ACCOUNT_SIZE) return null;
  return {
    owner: new PublicKeyClass(
      data.subarray(USER_STAKE_OWNER_OFFSET, USER_STAKE_OWNER_OFFSET + 32),
    ).toBase58(),
    amount: data.readBigUInt64LE(USER_STAKE_AMOUNT_OFFSET),
    stakedAt: Number(data.readBigInt64LE(USER_STAKE_STAKED_AT_OFFSET)),
    lockDuration: Number(data.readBigUInt64LE(USER_STAKE_LOCK_DURATION_OFFSET)),
    lockedUntil: Number(data.readBigInt64LE(USER_STAKE_LOCKED_UNTIL_OFFSET)),
  };
}

/** Parse a StakePool account's data buffer. Returns null if data is too small. */
export function parseStakePool(data: Buffer): ParsedStakePool | null {
  if (data.length < POOL_ACCOUNT_SIZE) return null;
  return {
    mint: new PublicKeyClass(data.subarray(8, 8 + 32)).toBase58(),
    vault: new PublicKeyClass(data.subarray(8 + 32, 8 + 32 + 32)).toBase58(),
    bump: data.readUInt8(8 + 32 + 32),
    totalStakers: Number(data.readBigUInt64LE(POOL_TOTAL_STAKERS_OFFSET)),
    totalStaked: data.readBigUInt64LE(POOL_TOTAL_STAKED_OFFSET),
  };
}

// ---------------------------------------------------------------------------
// Lock status helpers
// ---------------------------------------------------------------------------

export type LockStatus = {
  isLocked: boolean;
  /** Seconds remaining until unlock. 0 if already unlocked. */
  secondsRemaining: number;
  /** ISO string of the unlock date. */
  unlocksAt: string;
  /** Human-readable label for the lock duration (e.g. "30 days"). */
  durationLabel: string;
};

/** Compute lock status from a parsed user stake. */
export function getLockStatus(stake: ParsedUserStake): LockStatus {
  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, stake.lockedUntil - nowSec);
  return {
    isLocked: remaining > 0,
    secondsRemaining: remaining,
    unlocksAt: new Date(stake.lockedUntil * 1000).toISOString(),
    durationLabel: lockDurationLabel(stake.lockDuration),
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetch all stakers with their full stake metadata. */
export async function fetchAllStakers(
  connection: Connection,
  programId: PublicKeyClass | null,
): Promise<StakerEntry[]> {
  if (!programId) return [];
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: USER_STAKE_ACCOUNT_SIZE }],
    });
    return accounts
      .map(({ account }) => {
        const parsed = parseUserStake(account.data as Buffer);
        if (!parsed || parsed.amount === 0n) return null;
        return {
          owner: parsed.owner,
          amount: parsed.amount,
          stakedAt: parsed.stakedAt,
          lockDuration: parsed.lockDuration,
          lockedUntil: parsed.lockedUntil,
        };
      })
      .filter((e): e is StakerEntry => e !== null);
  } catch {
    return [];
  }
}

/**
 * Fetch staked amount (raw, with decimals) for a wallet.
 * Returns 0n if no stake account, program not deployed, or program ID not set.
 */
export async function fetchStakedBalance(
  connection: Connection,
  programId: PublicKeyClass | null,
  walletAddress: string | PublicKeyClass,
): Promise<bigint> {
  if (!programId) return 0n;
  try {
    const [poolPda] = getPoolPda(programId);
    const user =
      typeof walletAddress === "string"
        ? new PublicKeyClass(walletAddress)
        : walletAddress;
    const [userStakePda] = getUserStakePda(programId, poolPda, user);
    const account = await connection.getAccountInfo(userStakePda);
    if (!account) return 0n;
    const parsed = parseUserStake(account.data as Buffer);
    return parsed?.amount ?? 0n;
  } catch {
    return 0n;
  }
}

/**
 * Fetch full stake info for a wallet. Returns null if no stake account exists.
 */
export async function fetchUserStake(
  connection: Connection,
  programId: PublicKeyClass | null,
  walletAddress: string | PublicKeyClass,
): Promise<ParsedUserStake | null> {
  if (!programId) return null;
  try {
    const [poolPda] = getPoolPda(programId);
    const user =
      typeof walletAddress === "string"
        ? new PublicKeyClass(walletAddress)
        : walletAddress;
    const [userStakePda] = getUserStakePda(programId, poolPda, user);
    const account = await connection.getAccountInfo(userStakePda);
    if (!account) return null;
    return parseUserStake(account.data as Buffer);
  } catch {
    return null;
  }
}

/**
 * Fetch pool stats (total stakers, total staked). Returns null if pool not initialized.
 */
export async function fetchPoolStats(
  connection: Connection,
  programId: PublicKeyClass | null,
): Promise<ParsedStakePool | null> {
  if (!programId) return null;
  try {
    const [poolPda] = getPoolPda(programId);
    const account = await connection.getAccountInfo(poolPda);
    if (!account) return null;
    return parseStakePool(account.data as Buffer);
  } catch {
    return null;
  }
}

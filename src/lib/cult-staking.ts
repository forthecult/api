/**
 * CULT on-chain staking program helpers.
 *
 * Program: Native immutable staking program.
 * Set CULT_STAKING_PROGRAM_ID=8QZ3EZYFXET2et4bTDoxfQMJTjhRqYTaJbSQf5eEX8Zk
 *
 * This program uses per-tier stake entries — a user can have separate stakes
 * for 30-day (tier 0) and 12-month (tier 1) locks.
 *
 * Lock durations:
 *   - 30 days  = 2_592_000 seconds (tier 0)
 *   - 12 months = 31_536_000 seconds (tier 1)
 *
 * Note: Instruction/transaction builders live in cult-staking-instructions.ts
 * (server-only, uses node:crypto). Do not import that file from client components.
 */

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { type Connection, PublicKey as PublicKeyClass } from "@solana/web3.js";

import {
  CULT_MINT_MAINNET,
  TOKEN_2022_PROGRAM_ID_BASE58,
} from "./token-config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VAULT_AUTH_SEED = Buffer.from("vault_auth");
const STAKE_SEED = Buffer.from("stake");

/** 30 days in seconds. */
export const LOCK_30_DAYS = 2_592_000;
/** 365 days in seconds (12 months). */
export const LOCK_12_MONTHS = 31_536_000;

export type LockDuration = typeof LOCK_12_MONTHS | typeof LOCK_30_DAYS;

/** Lock tier 0 = 30 days */
export const TIER_30_DAYS = 0;
/** Lock tier 1 = 12 months */
export const TIER_12_MONTHS = 1;

export type LockTier = typeof TIER_12_MONTHS | typeof TIER_30_DAYS;

/** StakeEntry discriminator: "STAKE_V1" */
const STAKE_ENTRY_DISCRIMINATOR = new Uint8Array([
  0x53, 0x54, 0x41, 0x4b, 0x45, 0x5f, 0x56, 0x31,
]);

// ---------------------------------------------------------------------------
// Program ID
// ---------------------------------------------------------------------------

/** Convert duration to tier */
export function durationToTier(d: number): LockTier {
  return d === LOCK_12_MONTHS ? TIER_12_MONTHS : TIER_30_DAYS;
}

// ---------------------------------------------------------------------------
// PDAs
// ---------------------------------------------------------------------------

/** Stake entry PDA: seeds = ["stake", user, mint, lock_tier] */
export function getStakeEntryPda(
  programId: PublicKeyClass,
  user: PublicKeyClass,
  lockTier: LockTier,
  mint: PublicKeyClass = new PublicKeyClass(CULT_MINT_MAINNET),
): [PublicKeyClass, number] {
  return PublicKeyClass.findProgramAddressSync(
    [STAKE_SEED, user.toBuffer(), mint.toBuffer(), Buffer.from([lockTier])],
    programId,
  );
}

/**
 * Staking program ID.
 * Set CULT_STAKING_PROGRAM_ID (server) / NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID (client).
 * Returns null if not set (staking disabled).
 */
export function getStakingProgramId(): null | PublicKeyClass {
  const id =
    typeof process.env.CULT_STAKING_PROGRAM_ID === "string"
      ? process.env.CULT_STAKING_PROGRAM_ID.trim()
      : typeof process.env.NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID === "string"
        ? process.env.NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID.trim()
        : "";
  if (!id) return null;
  return new PublicKeyClass(id);
}

/** Get vault ATA address: vault = ATA(mint, vaultAuthority). */
export function getVaultAta(
  mint: PublicKeyClass,
  vaultAuthority: PublicKeyClass,
): PublicKeyClass {
  return getAssociatedTokenAddressSync(
    mint,
    vaultAuthority,
    true, // allowOwnerOffCurve for PDA
    new PublicKeyClass(TOKEN_2022_PROGRAM_ID_BASE58),
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** Vault authority PDA: seeds = ["vault_auth", mint] */
export function getVaultAuthorityPda(
  programId: PublicKeyClass,
  mint: PublicKeyClass = new PublicKeyClass(CULT_MINT_MAINNET),
): [PublicKeyClass, number] {
  return PublicKeyClass.findProgramAddressSync(
    [VAULT_AUTH_SEED, mint.toBuffer()],
    programId,
  );
}

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

/** Convert tier to duration */
export function tierToDuration(tier: LockTier): LockDuration {
  return tier === TIER_12_MONTHS ? LOCK_12_MONTHS : LOCK_30_DAYS;
}

// ---------------------------------------------------------------------------
// Account layout: StakeEntry (100 bytes)
//   8   discriminator  ("STAKE_V1")
//  32   staker         (Pubkey)
//  32   mint           (Pubkey)
//   8   amount         (u64)
//   8   lock_start     (i64)
//   8   lock_duration  (i64)
//   1   lock_tier      (u8)
//   1   is_withdrawn   (bool)
//   1   bump           (u8)
//   1   vault_auth_bump (u8)
// = 100 bytes total
// ---------------------------------------------------------------------------

const STAKE_ENTRY_SIZE = 100;
const OFFSET_DISCRIMINATOR = 0;
const OFFSET_STAKER = 8;
const OFFSET_MINT = 40;
const OFFSET_AMOUNT = 72;
const OFFSET_LOCK_START = 80;
const OFFSET_LOCK_DURATION = 88;
const OFFSET_LOCK_TIER = 96;
const OFFSET_IS_WITHDRAWN = 97;

// ---------------------------------------------------------------------------
// Parsed types
// ---------------------------------------------------------------------------

export interface LockStatus {
  /** Human-readable label for the lock duration (e.g. "30 days"). */
  durationLabel: string;
  isLocked: boolean;
  /** Seconds remaining until unlock. 0 if already unlocked. */
  secondsRemaining: number;
  /** ISO string of the unlock date. */
  unlocksAt: string;
}

export interface ParsedStakeEntry {
  amount: bigint;
  isWithdrawn: boolean;
  lockDuration: number;
  lockStart: number;
  lockTier: LockTier;
  mint: string;
  staker: string;
}

export interface ParsedStakePool {
  mint: string;
  totalStaked: bigint;
  totalStakers: number;
  vault: string;
}

// ---------------------------------------------------------------------------
// Account parsing
// ---------------------------------------------------------------------------

/** Combined stakes for both tiers */
export interface UserStakes {
  /** Whether user has any active (non-withdrawn) stake */
  hasActiveStake: boolean;
  tier12Months: null | ParsedStakeEntry;
  tier30Days: null | ParsedStakeEntry;
  /** Total staked across both tiers */
  totalAmount: bigint;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all active stakers. Used for staker count display.
 * Note: This scans all program accounts — may be slow with many stakers.
 */
export async function fetchAllStakers(
  connection: Connection,
  programId: null | PublicKeyClass,
): Promise<
  {
    amount: bigint;
    lockDuration: number;
    lockTier: LockTier;
    owner: string;
    stakedAt: number;
  }[]
> {
  if (!programId) return [];
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: STAKE_ENTRY_SIZE }],
    });
    return accounts
      .map(({ account }) => {
        const parsed = parseStakeEntry(Buffer.from(account.data));
        if (!parsed || parsed.isWithdrawn || parsed.amount === 0n) return null;
        return {
          amount: parsed.amount,
          lockDuration: parsed.lockDuration,
          lockTier: parsed.lockTier,
          owner: parsed.staker,
          stakedAt: parsed.lockStart,
        };
      })
      .filter(
        (
          e,
        ): e is {
          amount: bigint;
          lockDuration: number;
          lockTier: LockTier;
          owner: string;
          stakedAt: number;
        } => e !== null,
      );
  } catch {
    return [];
  }
}

/**
 * Fetch pool-like stats by scanning all stake accounts.
 * Note: The native program doesn't have a pool account, so we derive stats
 * by scanning all stake entries.
 */
export async function fetchPoolStats(
  connection: Connection,
  programId: null | PublicKeyClass,
): Promise<null | ParsedStakePool> {
  if (!programId) return null;
  try {
    const stakers = await fetchAllStakers(connection, programId);
    if (stakers.length === 0) return null;

    const uniqueWallets = new Set(stakers.map((s) => s.owner));
    const totalStaked = stakers.reduce((sum, s) => sum + s.amount, 0n);

    const mint = new PublicKeyClass(CULT_MINT_MAINNET);
    const [vaultAuth] = getVaultAuthorityPda(programId, mint);
    const vault = getVaultAta(mint, vaultAuth);

    return {
      mint: CULT_MINT_MAINNET,
      totalStaked,
      totalStakers: uniqueWallets.size,
      vault: vault.toBase58(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch total staked amount across both tiers.
 * Returns 0n if no stakes or program not configured.
 */
export async function fetchStakedBalance(
  connection: Connection,
  programId: null | PublicKeyClass,
  walletAddress: PublicKeyClass | string,
): Promise<bigint> {
  const stakes = await fetchUserStakes(connection, programId, walletAddress);
  return stakes.totalAmount;
}

/**
 * Fetch stake entry for a specific tier. Returns null if no stake exists.
 */
export async function fetchStakeEntry(
  connection: Connection,
  programId: null | PublicKeyClass,
  walletAddress: PublicKeyClass | string,
  lockTier: LockTier,
): Promise<null | ParsedStakeEntry> {
  if (!programId) return null;
  try {
    const user =
      typeof walletAddress === "string"
        ? new PublicKeyClass(walletAddress)
        : walletAddress;
    const [stakeEntryPda] = getStakeEntryPda(programId, user, lockTier);
    const account = await connection.getAccountInfo(stakeEntryPda);
    if (!account) return null;
    const parsed = parseStakeEntry(Buffer.from(account.data));
    if (!parsed || parsed.isWithdrawn) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Get unique staker count (each wallet counted once even if they have both tier stakes).
 */
export async function fetchStakerCount(
  connection: Connection,
  programId: null | PublicKeyClass,
): Promise<number> {
  const stakers = await fetchAllStakers(connection, programId);
  const uniqueWallets = new Set(stakers.map((s) => s.owner));
  return uniqueWallets.size;
}

/**
 * Legacy compatibility: Fetch user stake (returns the stake with longer lock or higher amount).
 * Used by code that expects a single stake per user.
 */
export async function fetchUserStake(
  connection: Connection,
  programId: null | PublicKeyClass,
  walletAddress: PublicKeyClass | string,
): Promise<null | ParsedStakeEntry> {
  const stakes = await fetchUserStakes(connection, programId, walletAddress);

  // prefer 12-month stake if exists, otherwise 30-day
  if (stakes.tier12Months) return stakes.tier12Months;
  if (stakes.tier30Days) return stakes.tier30Days;
  return null;
}

// ---------------------------------------------------------------------------
// Lock status helpers
// ---------------------------------------------------------------------------

/**
 * Fetch both tier stakes for a wallet.
 */
export async function fetchUserStakes(
  connection: Connection,
  programId: null | PublicKeyClass,
  walletAddress: PublicKeyClass | string,
): Promise<UserStakes> {
  const empty: UserStakes = {
    hasActiveStake: false,
    tier12Months: null,
    tier30Days: null,
    totalAmount: 0n,
  };

  if (!programId) return empty;

  const [tier30Days, tier12Months] = await Promise.all([
    fetchStakeEntry(connection, programId, walletAddress, TIER_30_DAYS),
    fetchStakeEntry(connection, programId, walletAddress, TIER_12_MONTHS),
  ]);

  const amount30 = tier30Days?.amount ?? 0n;
  const amount12 = tier12Months?.amount ?? 0n;

  return {
    hasActiveStake: tier30Days !== null || tier12Months !== null,
    tier12Months,
    tier30Days,
    totalAmount: amount30 + amount12,
  };
}

// ---------------------------------------------------------------------------
// Pool stats compatibility (no pool account in native program)
// ---------------------------------------------------------------------------

/** Compute lock status from a parsed stake entry. */
export function getLockStatus(stake: ParsedStakeEntry): LockStatus {
  const nowSec = Math.floor(Date.now() / 1000);
  const unlocksAtSec = stake.lockStart + stake.lockDuration;
  const remaining = Math.max(0, unlocksAtSec - nowSec);
  return {
    durationLabel: lockDurationLabel(stake.lockDuration),
    isLocked: remaining > 0,
    secondsRemaining: remaining,
    unlocksAt: new Date(unlocksAtSec * 1000).toISOString(),
  };
}

// keep the old pool PDA function for compatibility, but it's not used by native program
export function getPoolPda(
  programId: PublicKeyClass,
): [PublicKeyClass, number] {
  // native program doesn't have a pool PDA, return vault authority instead
  return getVaultAuthorityPda(programId);
}

// keep old getUserStakePda for compatibility but redirect to tier-0
export function getUserStakePda(
  programId: PublicKeyClass,
  _poolPda: PublicKeyClass,
  user: PublicKeyClass,
): [PublicKeyClass, number] {
  // default to tier 0 (30 days) for backwards compatibility
  return getStakeEntryPda(programId, user, TIER_30_DAYS);
}

/** Parse a StakeEntry account's data buffer. Returns null if invalid. */
export function parseStakeEntry(data: Buffer): null | ParsedStakeEntry {
  if (data.length < STAKE_ENTRY_SIZE) return null;

  // verify discriminator
  const discriminator = data.subarray(
    OFFSET_DISCRIMINATOR,
    OFFSET_DISCRIMINATOR + 8,
  );
  if (!discriminator.every((b, i) => b === STAKE_ENTRY_DISCRIMINATOR[i])) {
    return null;
  }

  const isWithdrawn = data.readUInt8(OFFSET_IS_WITHDRAWN) !== 0;

  return {
    amount: data.readBigUInt64LE(OFFSET_AMOUNT),
    isWithdrawn,
    lockDuration: Number(data.readBigInt64LE(OFFSET_LOCK_DURATION)),
    lockStart: Number(data.readBigInt64LE(OFFSET_LOCK_START)),
    lockTier: data.readUInt8(OFFSET_LOCK_TIER) as LockTier,
    mint: new PublicKeyClass(
      data.subarray(OFFSET_MINT, OFFSET_MINT + 32),
    ).toBase58(),
    staker: new PublicKeyClass(
      data.subarray(OFFSET_STAKER, OFFSET_STAKER + 32),
    ).toBase58(),
  };
}

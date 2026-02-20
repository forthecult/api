/**
 * Server-only: Native program instruction builders.
 *
 * Instruction format for the native staking program:
 *   Stake:   [0, lock_tier, amount_le_bytes(8)] = 10 bytes
 *   Unstake: [1, lock_tier] = 2 bytes
 */

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey as PublicKeyClass,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  durationToTier,
  getStakeEntryPda,
  getVaultAta,
  getVaultAuthorityPda,
  isValidLockDuration,
  type LockDuration,
  type LockTier,
  TIER_30_DAYS,
  TIER_12_MONTHS,
} from "~/lib/cult-staking";
import { CULT_MINT_MAINNET, TOKEN_2022_PROGRAM_ID_BASE58 } from "./token-config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_2022_PROGRAM_ID = new PublicKeyClass(TOKEN_2022_PROGRAM_ID_BASE58);
const CULT_MINT = new PublicKeyClass(CULT_MINT_MAINNET);

/** Instruction tag for Stake */
const IX_TAG_STAKE = 0;
/** Instruction tag for Unstake */
const IX_TAG_UNSTAKE = 1;

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

/**
 * Build stake instruction for native program.
 *
 * Accounts (order matters):
 *   0. staker (signer, writable)
 *   1. staker_token_account (writable)
 *   2. vault_token_account (writable)
 *   3. vault_authority PDA (read-only)
 *   4. mint (read-only)
 *   5. stake_entry PDA (writable)
 *   6. token_program (Token-2022)
 *   7. system_program
 */
export function buildStakeInstruction(params: {
  amount: bigint;
  lockTier: LockTier;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  stakeEntryPda: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  vaultAuthority: PublicKeyClass;
  vaultTokenAccount: PublicKeyClass;
}): TransactionInstruction {
  const {
    amount,
    lockTier,
    mint,
    owner,
    programId,
    stakeEntryPda,
    userTokenAccount,
    vaultAuthority,
    vaultTokenAccount,
  } = params;

  if (amount <= 0n) throw new Error("Stake amount must be positive");

  // instruction data: [tag(1), lock_tier(1), amount_le(8)] = 10 bytes
  const data = Buffer.alloc(10);
  data.writeUInt8(IX_TAG_STAKE, 0);
  data.writeUInt8(lockTier, 1);
  data.writeBigUInt64LE(amount, 2);

  return new TransactionInstruction({
    data,
    keys: [
      { isSigner: true, isWritable: true, pubkey: owner },
      { isSigner: false, isWritable: true, pubkey: userTokenAccount },
      { isSigner: false, isWritable: true, pubkey: vaultTokenAccount },
      { isSigner: false, isWritable: false, pubkey: vaultAuthority },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: stakeEntryPda },
      { isSigner: false, isWritable: false, pubkey: TOKEN_2022_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId,
  });
}

/**
 * Build unstake instruction for native program.
 *
 * Accounts (order matters):
 *   0. staker (signer, writable)
 *   1. staker_token_account (writable)
 *   2. vault_token_account (writable)
 *   3. vault_authority PDA (read-only)
 *   4. mint (read-only)
 *   5. stake_entry PDA (writable)
 *   6. token_program (Token-2022)
 */
export function buildUnstakeInstruction(params: {
  lockTier: LockTier;
  mint: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  stakeEntryPda: PublicKeyClass;
  userTokenAccount: PublicKeyClass;
  vaultAuthority: PublicKeyClass;
  vaultTokenAccount: PublicKeyClass;
}): TransactionInstruction {
  const {
    lockTier,
    mint,
    owner,
    programId,
    stakeEntryPda,
    userTokenAccount,
    vaultAuthority,
    vaultTokenAccount,
  } = params;

  // instruction data: [tag(1), lock_tier(1)] = 2 bytes
  const data = Buffer.alloc(2);
  data.writeUInt8(IX_TAG_UNSTAKE, 0);
  data.writeUInt8(lockTier, 1);

  return new TransactionInstruction({
    data,
    keys: [
      { isSigner: true, isWritable: true, pubkey: owner },
      { isSigner: false, isWritable: true, pubkey: userTokenAccount },
      { isSigner: false, isWritable: true, pubkey: vaultTokenAccount },
      { isSigner: false, isWritable: false, pubkey: vaultAuthority },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: stakeEntryPda },
      { isSigner: false, isWritable: false, pubkey: TOKEN_2022_PROGRAM_ID },
    ],
    programId,
  });
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

/**
 * Build a stake transaction.
 * Optionally includes vault ATA creation if it doesn't exist.
 */
export function buildStakeTransaction(params: {
  amount: bigint;
  blockhash: string;
  createVaultAta?: boolean;
  lastValidBlockHeight: number;
  lockDuration: LockDuration;
  mint?: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
}): Transaction {
  const {
    amount,
    blockhash,
    createVaultAta = false,
    lastValidBlockHeight,
    lockDuration,
    owner,
    programId,
  } = params;

  if (!isValidLockDuration(lockDuration)) {
    throw new Error("Invalid lock duration");
  }

  const mint = params.mint ?? CULT_MINT;
  const lockTier = durationToTier(lockDuration);

  const [vaultAuthority] = getVaultAuthorityPda(programId, mint);
  const vaultTokenAccount = getVaultAta(mint, vaultAuthority);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [stakeEntryPda] = getStakeEntryPda(programId, owner, lockTier, mint);

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = owner;

  // optionally create vault ATA if this is the first stake ever
  if (createVaultAta) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        vaultTokenAccount,
        vaultAuthority,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  tx.add(
    buildStakeInstruction({
      amount,
      lockTier,
      mint,
      owner,
      programId,
      stakeEntryPda,
      userTokenAccount,
      vaultAuthority,
      vaultTokenAccount,
    }),
  );

  return tx;
}

/**
 * Build an unstake transaction.
 */
export function buildUnstakeTransaction(params: {
  blockhash: string;
  lastValidBlockHeight: number;
  lockTier: LockTier;
  mint?: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
}): Transaction {
  const { blockhash, lastValidBlockHeight, lockTier, owner, programId } =
    params;

  const mint = params.mint ?? CULT_MINT;

  const [vaultAuthority] = getVaultAuthorityPda(programId, mint);
  const vaultTokenAccount = getVaultAta(mint, vaultAuthority);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [stakeEntryPda] = getStakeEntryPda(programId, owner, lockTier, mint);

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = owner;

  tx.add(
    buildUnstakeInstruction({
      lockTier,
      mint,
      owner,
      programId,
      stakeEntryPda,
      userTokenAccount,
      vaultAuthority,
      vaultTokenAccount,
    }),
  );

  return tx;
}

/**
 * Build a restake transaction (unstake then stake in same tx).
 * Only works when the lock has expired.
 * Note: Native program creates new stake entry, so this won't work as a single tx.
 * For restake, user must unstake first, then stake again.
 */
export function buildRestakeTransaction(params: {
  amount: bigint;
  blockhash: string;
  lastValidBlockHeight: number;
  lockDuration: LockDuration;
  mint?: PublicKeyClass;
  oldLockTier: LockTier;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
}): Transaction {
  const {
    amount,
    blockhash,
    lastValidBlockHeight,
    lockDuration,
    oldLockTier,
    owner,
    programId,
  } = params;

  if (!isValidLockDuration(lockDuration)) {
    throw new Error("Invalid lock duration");
  }

  const mint = params.mint ?? CULT_MINT;
  const newLockTier = durationToTier(lockDuration);

  const [vaultAuthority] = getVaultAuthorityPda(programId, mint);
  const vaultTokenAccount = getVaultAta(mint, vaultAuthority);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [oldStakeEntryPda] = getStakeEntryPda(
    programId,
    owner,
    oldLockTier,
    mint,
  );
  const [newStakeEntryPda] = getStakeEntryPda(
    programId,
    owner,
    newLockTier,
    mint,
  );

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = owner;

  // unstake from old tier
  tx.add(
    buildUnstakeInstruction({
      lockTier: oldLockTier,
      mint,
      owner,
      programId,
      stakeEntryPda: oldStakeEntryPda,
      userTokenAccount,
      vaultAuthority,
      vaultTokenAccount,
    }),
  );

  // stake to new tier
  tx.add(
    buildStakeInstruction({
      amount,
      lockTier: newLockTier,
      mint,
      owner,
      programId,
      stakeEntryPda: newStakeEntryPda,
      userTokenAccount,
      vaultAuthority,
      vaultTokenAccount,
    }),
  );

  return tx;
}

// ---------------------------------------------------------------------------
// Legacy compatibility exports (not used by native program but kept for API)
// ---------------------------------------------------------------------------

/** @deprecated Native program doesn't need initialization */
export function buildInitializeInstruction(_params: {
  authority: PublicKeyClass;
  mint: PublicKeyClass;
  poolPda: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
  vault: PublicKeyClass;
}): TransactionInstruction {
  throw new Error(
    "Native staking program does not require initialization. Vault ATA is created on first stake.",
  );
}

/** @deprecated Native program doesn't need initialization */
export function buildInitializeTransaction(_params: {
  authority: PublicKeyClass;
  blockhash: string;
  lastValidBlockHeight: number;
  mint: PublicKeyClass;
  programId: PublicKeyClass;
  tokenProgram?: PublicKeyClass;
}): Transaction {
  throw new Error(
    "Native staking program does not require initialization. Vault ATA is created on first stake.",
  );
}

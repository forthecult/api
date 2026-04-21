/**
 * Server-only: Native (immutable) staking program instruction builders.
 *
 * Instruction format (1-byte tags):
 *   Stake:   [0, lock_tier, amount(8 LE)] = 10 bytes
 *   Unstake: [1, lock_tier] = 2 bytes
 *
 * Program ID: 8QZ3EZYFXET2et4bTDoxfQMJTjhRqYTaJbSQf5eEX8Zk (immutable)
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

// memo program for adding human-readable transaction descriptions
const MEMO_PROGRAM_ID = new PublicKeyClass(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

/** Create a memo instruction with a human-readable message */
function createMemoInstruction(
  message: string,
  signer: PublicKeyClass,
): TransactionInstruction {
  return new TransactionInstruction({
    data: Buffer.from(message, "utf-8"),
    keys: [{ isSigner: true, isWritable: false, pubkey: signer }],
    programId: MEMO_PROGRAM_ID,
  });
}

import {
  durationToTier,
  getStakeEntryPda,
  getVaultAta,
  getVaultAuthorityPda,
  isValidLockDuration,
  LOCK_30_DAYS,
  type LockDuration,
  type LockTier,
  TIER_30_DAYS,
} from "~/lib/cult-staking";

import {
  CULT_MINT_MAINNET,
  TOKEN_2022_PROGRAM_ID_BASE58,
} from "./token-config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_2022_PROGRAM_ID = new PublicKeyClass(TOKEN_2022_PROGRAM_ID_BASE58);
const CULT_MINT = new PublicKeyClass(CULT_MINT_MAINNET);

// native format: 1-byte instruction tags (immutable program)

// ---------------------------------------------------------------------------
// Instruction builders
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

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

/**
 * Build a restake transaction (unstake then stake in same tx).
 * Only works when the lock has expired.
 * Note: Native program creates new stake entry, so this won't work as a single tx.
 * For restake, user must unstake first, then stake again.
 * Includes a memo instruction for better wallet display.
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
  tokenSymbol?: string;
}): Transaction {
  const {
    amount,
    blockhash,
    lastValidBlockHeight,
    lockDuration,
    oldLockTier,
    owner,
    programId,
    tokenSymbol = "CULT",
  } = params;

  if (!isValidLockDuration(lockDuration)) {
    throw new Error("Invalid lock duration");
  }

  const mint = params.mint ?? CULT_MINT;
  const newLockTier = durationToTier(lockDuration);
  const newDurationLabel =
    lockDuration === LOCK_30_DAYS ? "30 days" : "12 months";

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

  // add memo for wallet display
  const memo = `Restake ${tokenSymbol} to ${newDurationLabel} membership - forthecult.store`;
  tx.add(createMemoInstruction(memo, owner));

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

  // native format: [tag(1), lock_tier(1), amount(8 LE)] = 10 bytes
  const data = Buffer.alloc(10);
  data.writeUInt8(0, 0);
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
 * Build a stake transaction.
 * Optionally includes vault ATA creation if it doesn't exist.
 * Includes a memo instruction for better wallet display.
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
  tokenDecimals?: number;
  tokenSymbol?: string;
}): Transaction {
  const {
    amount,
    blockhash,
    createVaultAta = false,
    lastValidBlockHeight,
    lockDuration,
    owner,
    programId,
    tokenDecimals = 6,
    tokenSymbol = "CULT",
  } = params;

  if (!isValidLockDuration(lockDuration)) {
    throw new Error("Invalid lock duration");
  }

  const mint = params.mint ?? CULT_MINT;
  const lockTier = durationToTier(lockDuration);
  const durationLabel = lockDuration === LOCK_30_DAYS ? "30 days" : "12 months";

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

  // add memo for wallet display - shows human-readable description
  const humanAmount = Number(amount) / 10 ** tokenDecimals;
  const formattedAmount = humanAmount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  const memo = `Stake ${formattedAmount} ${tokenSymbol} for ${durationLabel} - forthecult.store membership`;
  tx.add(createMemoInstruction(memo, owner));

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

// ---------------------------------------------------------------------------
// Legacy compatibility exports (not used by native program but kept for API)
// ---------------------------------------------------------------------------

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

  // native format: [tag(1), lock_tier(1)] = 2 bytes
  const data = Buffer.alloc(2);
  data.writeUInt8(1, 0);
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

/**
 * Build an unstake transaction.
 * Includes a memo instruction for better wallet display.
 */
export function buildUnstakeTransaction(params: {
  blockhash: string;
  lastValidBlockHeight: number;
  lockTier: LockTier;
  mint?: PublicKeyClass;
  owner: PublicKeyClass;
  programId: PublicKeyClass;
  tokenSymbol?: string;
}): Transaction {
  const {
    blockhash,
    lastValidBlockHeight,
    lockTier,
    owner,
    programId,
    tokenSymbol = "CULT",
  } = params;

  const mint = params.mint ?? CULT_MINT;
  const tierLabel = lockTier === TIER_30_DAYS ? "30-day" : "12-month";

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

  // add memo for wallet display
  const memo = `Unstake ${tokenSymbol} from ${tierLabel} membership - forthecult.store`;
  tx.add(createMemoInstruction(memo, owner));

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

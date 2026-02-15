/**
 * Solana Token Utilities
 *
 * Provides utilities for working with both standard SPL tokens (Token Program)
 * and Token-2022 tokens (Token Extensions Program).
 */

import { type Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  type Mint,
} from "@solana/spl-token";

export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID };

/**
 * Get the token balance for a wallet, checking both Token Program and Token-2022 Program.
 * Returns the balance from whichever program has the token account.
 */
export async function getTokenBalanceAnyProgram(
  connection: Connection,
  mintAddress: string | PublicKey,
  walletAddress: string | PublicKey,
): Promise<{ amount: bigint; decimals: number; programId: PublicKey } | null> {
  const mint =
    typeof mintAddress === "string" ? new PublicKey(mintAddress) : mintAddress;
  const wallet =
    typeof walletAddress === "string"
      ? new PublicKey(walletAddress)
      : walletAddress;

  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  for (const programId of programIds) {
    try {
      const ata = getAssociatedTokenAddressSync(mint, wallet, false, programId);
      const info = await connection.getTokenAccountBalance(ata);
      return {
        amount: BigInt(info.value.amount),
        decimals: info.value.decimals,
        programId,
      };
    } catch {
      // Continue to try next program
    }
  }

  return null;
}

/**
 * Get mint info, trying both Token Program and Token-2022 Program.
 * Returns the mint info from whichever program owns the mint.
 */
export async function getMintAnyProgram(
  connection: Connection,
  mintAddress: string | PublicKey,
): Promise<{ mint: Mint; programId: PublicKey } | null> {
  const mintPubkey =
    typeof mintAddress === "string" ? new PublicKey(mintAddress) : mintAddress;

  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  for (const programId of programIds) {
    try {
      const mint = await getMint(connection, mintPubkey, undefined, programId);
      return { mint, programId };
    } catch {
      // Continue to try next program
    }
  }

  return null;
}

/**
 * Get the Associated Token Address for a wallet, checking which program owns the mint.
 * This is useful when you need to derive the correct ATA based on the token's program.
 */
export async function getATAForMint(
  connection: Connection,
  mintAddress: string | PublicKey,
  walletAddress: string | PublicKey,
  allowOwnerOffCurve = false,
): Promise<{ ata: PublicKey; programId: PublicKey } | null> {
  const mintResult = await getMintAnyProgram(connection, mintAddress);
  if (!mintResult) return null;

  const mint =
    typeof mintAddress === "string" ? new PublicKey(mintAddress) : mintAddress;
  const wallet =
    typeof walletAddress === "string"
      ? new PublicKey(walletAddress)
      : walletAddress;
  const ata = getAssociatedTokenAddressSync(
    mint,
    wallet,
    allowOwnerOffCurve,
    mintResult.programId,
  );

  return { ata, programId: mintResult.programId };
}

/**
 * Detect which token program a mint belongs to.
 * Returns the program ID if found, null if the mint doesn't exist.
 */
export async function detectMintProgram(
  connection: Connection,
  mintAddress: string | PublicKey,
): Promise<PublicKey | null> {
  const result = await getMintAnyProgram(connection, mintAddress);
  return result?.programId ?? null;
}

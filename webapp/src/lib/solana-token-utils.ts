/**
 * Solana Token Utilities
 *
 * Provides utilities for working with both standard SPL tokens (Token Program)
 * and Token-2022 tokens (Token Extensions Program).
 */

import {
  getAssociatedTokenAddressSync,
  getMint,
  type Mint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";

export { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID };

/**
 * Detect which token program a mint belongs to.
 * Returns the program ID if found, null if the mint doesn't exist.
 */
export async function detectMintProgram(
  connection: Connection,
  mintAddress: PublicKey | string,
): Promise<null | PublicKey> {
  const result = await getMintAnyProgram(connection, mintAddress);
  return result?.programId ?? null;
}

/**
 * Get the Associated Token Address for a wallet, checking which program owns the mint.
 * This is useful when you need to derive the correct ATA based on the token's program.
 */
export async function getATAForMint(
  connection: Connection,
  mintAddress: PublicKey | string,
  walletAddress: PublicKey | string,
  allowOwnerOffCurve = false,
): Promise<null | { ata: PublicKey; programId: PublicKey }> {
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
 * Get mint info, trying both Token Program and Token-2022 Program.
 * Returns the mint info from whichever program owns the mint.
 */
export async function getMintAnyProgram(
  connection: Connection,
  mintAddress: PublicKey | string,
): Promise<null | { mint: Mint; programId: PublicKey }> {
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
 * Get the token balance for a wallet, checking both Token Program and Token-2022 Program.
 * Returns the balance from whichever program has the token account.
 */
export async function getTokenBalanceAnyProgram(
  connection: Connection,
  mintAddress: PublicKey | string,
  walletAddress: PublicKey | string,
): Promise<null | { amount: bigint; decimals: number; programId: PublicKey }> {
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

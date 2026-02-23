/**
 * Verify that the requester controls a wallet before using it for CULT member tier discounts.
 * Accepts: (1) authenticated user with that wallet linked, or (2) signed message from that wallet.
 * Future: (3) small x402 payment from that address could also prove control.
 */

import { PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { userWalletsTable } from "~/db/schema";
import { verifySolanaSignature } from "~/lib/verify-solana-signature";

const TIER_MESSAGE_PREFIX = "FortheCult tier verification\n";
const TIER_MESSAGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function normalizeSolanaAddress(address: string): string | null {
  try {
    return new PublicKey(address.trim()).toBase58();
  } catch {
    return null;
  }
}

/**
 * Build the message the client must sign for tier verification.
 * Use minute-precision ISO timestamp so client and server can agree without a round-trip.
 */
export function getTierVerificationMessage(date: Date = new Date()): string {
  const minute = new Date(date);
  minute.setSeconds(0, 0);
  return TIER_MESSAGE_PREFIX + minute.toISOString();
}

/**
 * Check that the message matches our format and timestamp is within the allowed window.
 */
function parseTierMessage(message: string): { valid: boolean; timestamp: number | null } {
  if (!message.startsWith(TIER_MESSAGE_PREFIX)) {
    return { valid: false, timestamp: null };
  }
  const rest = message.slice(TIER_MESSAGE_PREFIX.length).trim();
  const date = new Date(rest);
  const timestamp = Number.isNaN(date.getTime()) ? null : date.getTime();
  return { valid: timestamp !== null, timestamp };
}

export type VerifyWalletForTierParams = {
  wallet: string;
  userId?: null | string;
  walletMessage?: null | string;
  walletSignature?: null | string;
  walletSignatureBase58?: null | string;
};

export type VerifyWalletForTierResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Verify the requester is allowed to use the given wallet for tier discounts.
 * Returns ok: true if (1) user is authenticated and wallet is linked, or (2) valid signed message.
 */
export async function verifyWalletForTier(
  params: VerifyWalletForTierParams,
): Promise<VerifyWalletForTierResult> {
  const normalized = normalizeSolanaAddress(params.wallet);
  if (!normalized) {
    return { ok: false, error: "Invalid wallet address" };
  }

  // (1) Authenticated with wallet linked to account
  if (params.userId?.trim()) {
    const linked = await db
      .select({ address: userWalletsTable.address })
      .from(userWalletsTable)
      .where(eq(userWalletsTable.userId, params.userId.trim()));

    const normalizedLinked = linked
      .map((r) => normalizeSolanaAddress(r.address))
      .filter((a): a is string => a !== null);
    if (normalizedLinked.includes(normalized)) {
      return { ok: true };
    }
  }

  // (2) Signed message
  const message = params.walletMessage?.trim();
  const hasSignature =
    (params.walletSignature?.trim()?.length ?? 0) > 0 ||
    (params.walletSignatureBase58?.trim()?.length ?? 0) > 0;

  if (!message || !hasSignature) {
    return {
      ok: false,
      error:
        "Wallet must be linked to your account or verified with a signed message. Include walletMessage and walletSignature (or walletSignatureBase58). Use GET /api/checkout/wallet-verify-message to get the message to sign.",
    };
  }

  const { valid, timestamp } = parseTierMessage(message);
  if (!valid || timestamp === null) {
    return {
      ok: false,
      error:
        "Invalid message format. Use GET /api/checkout/wallet-verify-message to get the message to sign.",
    };
  }

  const age = Date.now() - timestamp;
  if (age < -60 * 1000 || age > TIER_MESSAGE_MAX_AGE_MS) {
    return {
      ok: false,
      error: "Message expired. Request a new message from GET /api/checkout/wallet-verify-message and sign again.",
    };
  }

  const validSig = verifySolanaSignature({
    address: normalized,
    message,
    signature: params.walletSignature ?? undefined,
    signatureBase58: params.walletSignatureBase58 ?? undefined,
  });
  if (!validSig) {
    return { ok: false, error: "Invalid signature for this wallet." };
  }

  return { ok: true };
}

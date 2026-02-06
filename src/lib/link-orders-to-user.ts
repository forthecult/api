/**
 * Link guest orders to a user when they sign up or sign in.
 * - By wallet: orders paid with this wallet (payerWalletAddress) get userId set.
 * - By email: orders with this email and no userId get userId set (call only when user is email-verified).
 */

import { and, isNull, sql } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";

function normalizeWalletAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

/** Solana addresses are base58 (case-sensitive); compare trimmed only. */
function normalizeSolanaAddress(addr: string | null | undefined): string {
  return (addr ?? "").trim();
}

/**
 * Link orders that have no userId to this user, by payer wallet address.
 * EVM: pass address lowercased (0x...). Solana: pass base58 address (we normalize to lowercase for DB comparison).
 * Safe to call after wallet sign-up/sign-in.
 */
export async function linkOrdersToUserByWallet(
  userId: string,
  walletAddress: string,
  options?: { isEvm?: boolean },
): Promise<number> {
  if (!userId || !walletAddress?.trim()) return 0;
  const normalized = options?.isEvm
    ? normalizeWalletAddress(walletAddress)
    : normalizeSolanaAddress(walletAddress);
  if (!normalized) return 0;

  const result = await db
    .update(ordersTable)
    .set({ userId, updatedAt: new Date() })
    .where(
      and(
        isNull(ordersTable.userId),
        options?.isEvm
          ? sql`lower(trim(${ordersTable.payerWalletAddress})) = ${normalized}`
          : sql`trim(${ordersTable.payerWalletAddress}) = ${normalized}`,
      ),
    );

  const count =
    result && "rowCount" in result
      ? (result as { rowCount: number }).rowCount
      : Array.isArray(result)
        ? result.length
        : 0;
  return typeof count === "number" ? count : 0;
}

/**
 * Link orders that have no userId to this user, by email.
 * Only call when user.emailVerified is true (so we don't attach orders to unverified sign-ups).
 * Safe to call on dashboard load when session user is verified.
 */
export async function linkOrdersToUserByEmail(
  userId: string,
  email: string,
): Promise<number> {
  if (!userId || !email?.trim()) return 0;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const result = await db
    .update(ordersTable)
    .set({ userId, updatedAt: new Date() })
    .where(
      and(
        isNull(ordersTable.userId),
        sql`lower(trim(${ordersTable.email})) = ${normalized}`,
      ),
    );

  const count =
    result && "rowCount" in result
      ? (result as { rowCount: number }).rowCount
      : Array.isArray(result)
        ? result.length
        : 0;
  return typeof count === "number" ? count : 0;
}

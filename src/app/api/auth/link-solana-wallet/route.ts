/**
 * POST /api/auth/link-solana-wallet
 *
 * Links a Solana wallet to the current user's account.
 * Used after staking to associate the wallet with the user's account.
 *
 * This endpoint does NOT require SIWE signature because:
 * - The user has already proven wallet ownership by signing the stake transaction
 * - This is only called after a successful on-chain stake
 *
 * Security: only links if user is logged in and wallet not already linked to another account.
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { createId } from "@paralleldrive/cuid2";

const SOLANA_PROVIDER_ID = "solana";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json(
      { error: "Not authenticated", linked: false },
      { status: 401 },
    );
  }

  let body: { wallet?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", linked: false },
      { status: 400 },
    );
  }

  const wallet = body.wallet?.trim();
  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return NextResponse.json(
      { error: "Invalid wallet address", linked: false },
      { status: 400 },
    );
  }

  try {
    // check if wallet is already linked to any account
    const existingAccount = await db
      .select({ id: accountTable.id, userId: accountTable.userId })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.providerId, SOLANA_PROVIDER_ID),
          eq(accountTable.accountId, wallet),
        ),
      )
      .limit(1);

    if (existingAccount.length > 0) {
      if (existingAccount[0].userId === user.id) {
        // already linked to this user
        return NextResponse.json({ alreadyLinked: true, linked: true });
      }
      // linked to different user
      return NextResponse.json(
        { error: "Wallet already linked to another account", linked: false },
        { status: 409 },
      );
    }

    // link the wallet to the current user
    const now = new Date();
    await db.insert(accountTable).values({
      id: createId(),
      accountId: wallet,
      providerId: SOLANA_PROVIDER_ID,
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ linked: true });
  } catch (err) {
    console.error("[link-solana-wallet] Error:", err);

    // handle race condition where wallet was linked between check and insert
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique constraint/i.test(msg)) {
      return NextResponse.json(
        { error: "Wallet already linked", linked: false },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Failed to link wallet", linked: false },
      { status: 500 },
    );
  }
}

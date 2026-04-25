/**
 * POST /api/auth/link-solana-wallet
 *
 * Links a solana wallet to the *currently authenticated user*. Nothing else.
 *
 * If no session is present, or the wallet is already linked to a different
 * account, we refuse and point the caller at the proper sign-in-with-solana
 * (SIWS) flow at `/api/auth/sign-in/solana/verify`, which issues a nonce +
 * verifies an ed25519 signature before creating a session.
 *
 * History: this endpoint used to auto-create / auto-sign-in sessions for any
 * wallet address passed in the body, on the theory that "the user proved
 * ownership by signing the stake transaction". The server never actually
 * verified that claim, so anyone who knew a staker's public address could take
 * over their account. Those branches have been removed — unauthenticated
 * callers must go through SIWS.
 */

import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, solanaWalletStakeClaimedTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";

const SOLANA_PROVIDER_ID = "solana";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json(
      {
        error:
          "Sign in first. Use /api/auth/sign-in/solana/verify (SIWS) to create a session for this wallet.",
        linked: false,
        needsSignIn: true,
      },
      { status: 401 },
    );
  }

  let body: { wallet?: string };
  try {
    body = (await request.json()) as typeof body;
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

    // wallet was previously used for staking: only the original owner may re-link it
    const stakeClaimed = await db
      .select({ userId: solanaWalletStakeClaimedTable.userId })
      .from(solanaWalletStakeClaimedTable)
      .where(eq(solanaWalletStakeClaimedTable.wallet, wallet))
      .limit(1);
    if (stakeClaimed.length > 0 && stakeClaimed[0]!.userId !== user.id) {
      return NextResponse.json(
        {
          error:
            "This wallet was previously used for staking and cannot be linked to another account.",
          linked: false,
        },
        { status: 409 },
      );
    }

    if (existingAccount.length > 0) {
      if (existingAccount[0].userId === user.id) {
        return NextResponse.json({ alreadyLinked: true, linked: true });
      }
      // wallet already belongs to a different user — do NOT silently sign them in;
      // that used to be the auth-bypass.
      return NextResponse.json(
        {
          error:
            "This wallet is already linked to another account. Sign in with that wallet via /api/auth/sign-in/solana/verify to use it.",
          linked: false,
          needsSignIn: true,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    await db.insert(accountTable).values({
      accountId: wallet,
      createdAt: now,
      id: createId(),
      providerId: SOLANA_PROVIDER_ID,
      updatedAt: now,
      userId: user.id,
    });

    return NextResponse.json({ linked: true });
  } catch (err) {
    console.error("[link-solana-wallet] Error:", err);

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

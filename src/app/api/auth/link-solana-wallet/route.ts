/**
 * POST /api/auth/link-solana-wallet
 *
 * Links a Solana wallet to the current user's account, or creates a new account
 * if the user is not logged in.
 *
 * Used after staking to associate the wallet with the user's account.
 *
 * This endpoint does NOT require SIWE signature because:
 * - The user has already proven wallet ownership by signing the stake transaction
 * - This is only called after a successful on-chain stake
 *
 * Behavior:
 * - If user is logged in: links wallet to their account (if not already linked elsewhere)
 * - If user is NOT logged in: creates a new wallet-based account and returns a session token
 */

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, sessionTable, userTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { createId } from "@paralleldrive/cuid2";

const SOLANA_PROVIDER_ID = "solana";
const SESSION_MAX_AGE_DAYS = 7;

export async function POST(request: Request) {
  const user = await getCurrentUser();

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

    // if user is logged in, try to link the wallet
    if (user?.id) {
      if (existingAccount.length > 0) {
        if (existingAccount[0].userId === user.id) {
          return NextResponse.json({ alreadyLinked: true, linked: true });
        }
        return NextResponse.json(
          { error: "Wallet already linked to another account", linked: false },
          { status: 409 },
        );
      }

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
    }

    // user is NOT logged in - check if wallet already has an account
    if (existingAccount.length > 0) {
      // wallet already has an account - create a session for that user
      const userId = existingAccount[0].userId;
      const sessionToken = createId();
      const now = new Date();
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

      await db.insert(sessionTable).values({
        id: createId(),
        userId,
        token: sessionToken,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      // set session cookie
      const cookieStore = await cookies();
      cookieStore.set("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
      });

      return NextResponse.json({ linked: true, signedIn: true });
    }

    // wallet doesn't have an account - create one
    const now = new Date();
    const userId = createId();
    const shortWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
    const placeholderEmail = `solana_${wallet.slice(0, 8)}@wallet.local`;

    // create user
    await db.insert(userTable).values({
      id: userId,
      name: `Solana User`,
      email: placeholderEmail,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    // create solana account link
    await db.insert(accountTable).values({
      id: createId(),
      accountId: wallet,
      providerId: SOLANA_PROVIDER_ID,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    // create session
    const sessionToken = createId();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(sessionTable).values({
      id: createId(),
      userId,
      token: sessionToken,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // set session cookie
    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
    });

    return NextResponse.json({ linked: true, signedIn: true, created: true });
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

/**
 * POST /api/auth/unlink-solana-wallet
 *
 * Unlinks a Solana wallet from the current user. If the wallet was used for
 * staking (tier history or current on-chain stake), it is recorded so it cannot
 * be linked to another account later (prevents double stake).
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  accountTable,
  membershipTierHistoryTable,
  solanaWalletStakeClaimedTable,
} from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";
import { getMemberTierForWallet } from "~/lib/get-member-tier";

const SOLANA_PROVIDER_ID = "solana";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { accountId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wallet = body.accountId?.trim();
  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 },
    );
  }

  const accountRow = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.providerId, SOLANA_PROVIDER_ID),
        eq(accountTable.accountId, wallet),
        eq(accountTable.userId, user.id),
      ),
    )
    .limit(1);

  if (accountRow.length === 0) {
    return NextResponse.json(
      { error: "Wallet not linked to your account" },
      { status: 404 },
    );
  }

  // if this wallet ever had stake (tier history or on-chain), record claim so it can't be linked to another account
  let hadStake = false;
  const historyRow = await db
    .select({ tier: membershipTierHistoryTable.tier })
    .from(membershipTierHistoryTable)
    .where(
      and(
        eq(membershipTierHistoryTable.wallet, wallet),
        isNotNull(membershipTierHistoryTable.tier),
      ),
    )
    .limit(1);
  if (historyRow.length > 0 && historyRow[0]?.tier != null) hadStake = true;
  if (!hadStake) {
    const tier = await getMemberTierForWallet(wallet);
    if (tier != null) hadStake = true;
  }

  if (hadStake) {
    await db
      .insert(solanaWalletStakeClaimedTable)
      .values({
        userId: user.id,
        wallet,
      })
      .onConflictDoNothing({ target: solanaWalletStakeClaimedTable.wallet });
  }

  await db.delete(accountTable).where(eq(accountTable.id, accountRow[0]!.id));

  return NextResponse.json({ ok: true, unlinked: true });
}

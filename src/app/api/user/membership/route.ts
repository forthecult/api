/**
 * GET /api/user/membership
 * Returns the current user's CULT membership tier (from staking, admin grant, or paid subscription).
 * Used by the header dropdown to show "Tier X Member".
 */

import { and, eq, gt, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { db } from "~/db";
import { accountTable, adminMembershipGrantTable } from "~/db/schema";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import {
  getAdminGrantedTier,
  getMemberTierForUser,
  getMemberTierForWallet,
  getSubscriptionTierForUser,
} from "~/lib/get-member-tier";

const TIER_NAMES: Record<number, string> = { 1: "APEX", 2: "PRIME", 3: "BASE" };

function bestTier(...tiers: (null | number)[]): null | number {
  const valid = tiers.filter((t): t is number => t != null);
  return valid.length > 0 ? Math.min(...valid) : null;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const accountWallets = await db
      .select({ address: accountTable.accountId, providerId: accountTable.providerId })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, userId),
          or(
            eq(accountTable.providerId, "solana"),
            eq(accountTable.providerId, "ethereum"),
          ),
        ),
      );

    const linkedWallets = await db
      .select({ address: userWalletsTable.address, chain: userWalletsTable.chain })
      .from(userWalletsTable)
      .where(eq(userWalletsTable.userId, userId));

    const solanaAddresses: string[] = [];
    for (const w of accountWallets) {
      if (w.providerId === "solana" && w.address) solanaAddresses.push(w.address);
    }
    for (const w of linkedWallets) {
      if (w.chain === "solana" && w.address && !solanaAddresses.includes(w.address)) {
        solanaAddresses.push(w.address);
      }
    }

    const wallet = solanaAddresses[0] ?? null;

    // resolve tier from all sources: staking, admin grant, and paid subscription
    let memberTier: number | null;
    if (wallet) {
      const [walletTier, adminTier, subTier] = await Promise.all([
        getMemberTierForWallet(wallet),
        getAdminGrantedTier(userId),
        getSubscriptionTierForUser(userId),
      ]);
      memberTier = bestTier(walletTier, adminTier, subTier);
    } else {
      memberTier = await getMemberTierForUser(userId);
    }
    const tierName =
      memberTier != null ? (TIER_NAMES[memberTier] ?? `Tier ${memberTier}`) : null;

    const now = new Date();
    const grantRows = await db
      .select({
        createdAt: adminMembershipGrantTable.createdAt,
        expiresAt: adminMembershipGrantTable.expiresAt,
      })
      .from(adminMembershipGrantTable)
      .where(
        and(
          eq(adminMembershipGrantTable.userId, userId),
          gt(adminMembershipGrantTable.expiresAt, now),
        ),
      )
      .limit(1);
    const grant = grantRows[0];
    const membershipExpiresAt = grant?.expiresAt?.toISOString() ?? null;
    const membershipDuration =
      grant?.expiresAt && grant?.createdAt
        ? grant.expiresAt.getTime() - grant.createdAt.getTime() > 60 * 24 * 60 * 60 * 1000
          ? "1y"
          : "30d"
        : null;

    return NextResponse.json({
      memberTier,
      membershipDuration,
      membershipExpiresAt,
      tierName,
      wallet: wallet ?? null,
    });
  } catch (e) {
    console.error("[api/user/membership] error:", e);
    return NextResponse.json({ error: "Failed to fetch membership" }, { status: 500 });
  }
}

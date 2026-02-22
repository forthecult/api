/**
 * GET /api/user/membership
 * Returns the current user's CULT membership tier (from their linked Solana wallet).
 * Used by the header dropdown to show "Tier X Member".
 */

import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { db } from "~/db";
import { accountTable } from "~/db/schema";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import {
  getAdminGrantedTier,
  getMemberTierForUser,
  getMemberTierForWallet,
} from "~/lib/get-member-tier";

const TIER_NAMES: Record<number, string> = { 1: "APEX", 2: "PRIME", 3: "BASE" };

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
    let memberTier: number | null;
    if (wallet) {
      const [walletTier, adminTier] = await Promise.all([
        getMemberTierForWallet(wallet),
        getAdminGrantedTier(userId),
      ]);
      // best tier: lower number = better; admin grant can supplement or override
      if (walletTier != null && adminTier != null)
        memberTier = Math.min(walletTier, adminTier);
      else memberTier = walletTier ?? adminTier ?? null;
    } else {
      memberTier = await getMemberTierForUser(userId);
    }
    const tierName =
      memberTier != null ? (TIER_NAMES[memberTier] ?? `Tier ${memberTier}`) : null;

    return NextResponse.json({
      memberTier,
      tierName,
      wallet: wallet ?? null,
    });
  } catch (e) {
    console.error("[api/user/membership] error:", e);
    return NextResponse.json({ error: "Failed to fetch membership" }, { status: 500 });
  }
}

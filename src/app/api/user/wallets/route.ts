/**
 * GET /api/user/wallets
 * Returns all linked wallet addresses for the current authenticated user.
 */

import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable } from "~/db/schema";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import { auth } from "~/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // get wallets from account table (Solana/Ethereum auth)
    const accountWallets = await db
      .select({
        address: accountTable.accountId,
        providerId: accountTable.providerId,
      })
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

    // get wallets from user_wallets table (linked wallets; column is "chain": "solana" | "evm")
    const linkedWallets = await db
      .select({
        address: userWalletsTable.address,
        chain: userWalletsTable.chain,
      })
      .from(userWalletsTable)
      .where(eq(userWalletsTable.userId, userId));

    // combine and dedupe; normalize chain to "solana" | "ethereum" for API
    const walletMap = new Map<
      string,
      { address: string; blockchain: string }
    >();

    for (const w of accountWallets) {
      const blockchain = w.providerId === "solana" ? "solana" : "ethereum";
      walletMap.set(w.address, { address: w.address, blockchain });
    }

    for (const w of linkedWallets) {
      if (!walletMap.has(w.address)) {
        const blockchain = w.chain === "evm" ? "ethereum" : w.chain;
        walletMap.set(w.address, { address: w.address, blockchain });
      }
    }

    return NextResponse.json({
      wallets: Array.from(walletMap.values()),
    });
  } catch (e) {
    console.error("[api/user/wallets] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch wallets" },
      { status: 500 },
    );
  }
}

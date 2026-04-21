/**
 * GET /api/admin/membership
 * Returns all members with staking data for the admin membership list
 */

import { Connection } from "@solana/web3.js";
import { eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, ordersTable, userTable } from "~/db/schema";
import { userWalletsTable } from "~/db/schema/wallets/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchUserStake,
  getLockStatus,
  getStakingProgramId,
} from "~/lib/cult-staking";
import { getMemberTierForWallet } from "~/lib/get-member-tier";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getActiveToken } from "~/lib/token-config";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface MemberRow {
  createdAt: null | string;
  email: string;
  id: string;
  image: null | string;
  lock: null | {
    durationLabel: string;
    isLocked: boolean;
    secondsRemaining: number;
    stakedAt: string;
    unlocksAt: string;
  };
  memberSince: null | string;
  name: string;
  orderCount: number;
  stakedBalance: string;
  stakedBalanceRaw: string;
  tier: null | number;
  walletAddress: null | string;
}

export interface MembershipListResponse {
  items: MemberRow[];
  limit: number;
  page: number;
  tokenSymbol: string;
  totalCount: number;
  totalPages: number;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ??
            String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;
    const tierFilter = request.nextUrl.searchParams.get("tier");

    const token = getActiveToken();
    const programId = getStakingProgramId();

    // get all users who have a Solana wallet (either in accountTable or userWalletsTable)
    const walletsFromAccounts = await db
      .select({
        address: accountTable.accountId,
        userId: accountTable.userId,
      })
      .from(accountTable)
      .where(eq(accountTable.providerId, "solana"));

    const walletsFromWallets = await db
      .select({
        address: userWalletsTable.address,
        userId: userWalletsTable.userId,
      })
      .from(userWalletsTable)
      .where(eq(userWalletsTable.chain, "solana"));

    // combine wallets by userId
    const walletsByUserId = new Map<string, string[]>();
    for (const w of walletsFromAccounts) {
      if (!w.userId || !w.address) continue;
      const existing = walletsByUserId.get(w.userId) ?? [];
      if (!existing.includes(w.address)) existing.push(w.address);
      walletsByUserId.set(w.userId, existing);
    }
    for (const w of walletsFromWallets) {
      if (!w.userId || !w.address) continue;
      const existing = walletsByUserId.get(w.userId) ?? [];
      if (!existing.includes(w.address)) existing.push(w.address);
      walletsByUserId.set(w.userId, existing);
    }

    const userIdsWithWallets = Array.from(walletsByUserId.keys());

    if (userIdsWithWallets.length === 0) {
      return NextResponse.json({
        items: [],
        limit,
        page,
        tokenSymbol: token.symbol,
        totalCount: 0,
        totalPages: 0,
      } satisfies MembershipListResponse);
    }

    // fetch staking data for all wallets
    const connection = programId
      ? new Connection(getSolanaRpcUrlServer())
      : null;
    const stakingDataByWallet = new Map<
      string,
      {
        lock: MemberRow["lock"];
        memberSince: null | string;
        stakedBalance: string;
        stakedBalanceRaw: string;
        tier: null | number;
      }
    >();

    // gather all unique wallet addresses
    const allWalletAddresses = new Set<string>();
    for (const wallets of walletsByUserId.values()) {
      for (const w of wallets) allWalletAddresses.add(w);
    }

    if (connection && programId) {
      for (const walletAddress of allWalletAddresses) {
        try {
          const tier = await getMemberTierForWallet(walletAddress);
          const stake = await fetchUserStake(
            connection,
            programId,
            walletAddress,
          );
          const lockStatus = stake ? getLockStatus(stake) : null;
          const stakedBalance = stake
            ? (Number(stake.amount) / 10 ** token.decimals).toFixed(
                token.decimals,
              )
            : "0";

          stakingDataByWallet.set(walletAddress, {
            lock:
              stake && lockStatus
                ? {
                    durationLabel: lockStatus.durationLabel,
                    isLocked: lockStatus.isLocked,
                    secondsRemaining: lockStatus.secondsRemaining,
                    stakedAt: new Date(stake.lockStart * 1000).toISOString(),
                    unlocksAt: lockStatus.unlocksAt,
                  }
                : null,
            memberSince: stake?.lockStart
              ? new Date(stake.lockStart * 1000).toISOString()
              : null,
            stakedBalance,
            stakedBalanceRaw: stake?.amount?.toString() ?? "0",
            tier,
          });
        } catch {
          stakingDataByWallet.set(walletAddress, {
            lock: null,
            memberSince: null,
            stakedBalance: "0",
            stakedBalanceRaw: "0",
            tier: null,
          });
        }
      }
    }

    // compute best tier per user
    const bestTierByUserId = new Map<string, null | number>();
    const bestWalletByUserId = new Map<string, string>();
    for (const [userId, wallets] of walletsByUserId) {
      let bestTier: null | number = null;
      let bestWallet = wallets[0] ?? "";
      for (const w of wallets) {
        const data = stakingDataByWallet.get(w);
        if (data?.tier != null && (bestTier === null || data.tier < bestTier)) {
          bestTier = data.tier;
          bestWallet = w;
        }
      }
      bestTierByUserId.set(userId, bestTier);
      bestWalletByUserId.set(userId, bestWallet);
    }

    // filter by tier if specified
    let filteredUserIds = userIdsWithWallets;
    if (tierFilter !== null && tierFilter !== "") {
      const tierNum = Number.parseInt(tierFilter, 10);
      if (!Number.isNaN(tierNum)) {
        filteredUserIds = userIdsWithWallets.filter(
          (uid) => bestTierByUserId.get(uid) === tierNum,
        );
      }
    }

    // only include users with an active stake (tier is not null)
    const membersWithStake = filteredUserIds.filter(
      (uid) => bestTierByUserId.get(uid) != null,
    );

    const totalCount = membersWithStake.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // sort by tier (best first), then by staked amount
    const sortedUserIds = membersWithStake.sort((a, b) => {
      const tierA = bestTierByUserId.get(a) ?? 999;
      const tierB = bestTierByUserId.get(b) ?? 999;
      if (tierA !== tierB) return tierA - tierB;
      const walletA = bestWalletByUserId.get(a) ?? "";
      const walletB = bestWalletByUserId.get(b) ?? "";
      const stakedA = BigInt(
        stakingDataByWallet.get(walletA)?.stakedBalanceRaw ?? "0",
      );
      const stakedB = BigInt(
        stakingDataByWallet.get(walletB)?.stakedBalanceRaw ?? "0",
      );
      return stakedB > stakedA ? 1 : stakedB < stakedA ? -1 : 0;
    });

    const paginatedUserIds = sortedUserIds.slice(offset, offset + limit);

    // fetch user details
    const users =
      paginatedUserIds.length > 0
        ? await db
            .select({
              createdAt: userTable.createdAt,
              email: userTable.email,
              id: userTable.id,
              image: userTable.image,
              name: userTable.name,
            })
            .from(userTable)
            .where(inArray(userTable.id, paginatedUserIds))
        : [];

    const usersById = new Map(users.map((u) => [u.id, u]));

    // fetch order counts
    const orderCounts =
      paginatedUserIds.length > 0
        ? await db
            .select({
              count: sql<number>`count(*)::int`.as("count"),
              userId: ordersTable.userId,
            })
            .from(ordersTable)
            .where(inArray(ordersTable.userId, paginatedUserIds))
            .groupBy(ordersTable.userId)
        : [];

    const orderCountByUserId = new Map<string, number>();
    for (const row of orderCounts) {
      if (row.userId)
        orderCountByUserId.set(row.userId, Number(row.count) || 0);
    }

    // build response items (maintain sort order)
    const items: MemberRow[] = [];
    for (const userId of paginatedUserIds) {
      const user = usersById.get(userId);
      if (!user) continue;

      const walletAddress = bestWalletByUserId.get(userId) ?? null;
      const stakingData = walletAddress
        ? stakingDataByWallet.get(walletAddress)
        : null;

      items.push({
        createdAt: user.createdAt?.toISOString() ?? null,
        email: user.email,
        id: user.id,
        image: user.image,
        lock: stakingData?.lock ?? null,
        memberSince: stakingData?.memberSince ?? null,
        name: user.name,
        orderCount: orderCountByUserId.get(user.id) ?? 0,
        stakedBalance: stakingData?.stakedBalance ?? "0",
        stakedBalanceRaw: stakingData?.stakedBalanceRaw ?? "0",
        tier: bestTierByUserId.get(userId) ?? null,
        walletAddress,
      });
    }

    return NextResponse.json({
      items,
      limit,
      page,
      tokenSymbol: token.symbol,
      totalCount,
      totalPages,
    } satisfies MembershipListResponse);
  } catch (err) {
    console.error("Admin membership list error:", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Failed to load members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

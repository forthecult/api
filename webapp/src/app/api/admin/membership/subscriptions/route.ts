/**
 * GET /api/admin/membership/subscriptions
 * Paginated list of membership subscriptions (`subscription_instance` for offer slug `membership`).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  subscriptionInstanceTable,
  subscriptionOfferTable,
  subscriptionPlanTable,
  userTable,
} from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  ensureMembershipCatalogSeeded,
  MEMBERSHIP_OFFER_SLUG,
} from "~/lib/membership-subscription-catalog";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const TIER_NAMES: Record<number, string> = {
  1: "APEX",
  2: "PRIME",
  3: "BASE",
};

export interface SubscriptionListResponse {
  items: SubscriptionRow[];
  limit: number;
  page: number;
  totalCount: number;
  totalPages: number;
}

export interface SubscriptionRow {
  billingProvider: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: null | string;
  currentPeriodStart: null | string;
  email: string;
  id: string;
  interval: string;
  name: string;
  status: string;
  tier: number;
  tierName: string;
  userId: string;
}

export async function GET(request: NextRequest) {
  try {
    await ensureMembershipCatalogSeeded();
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
    const providerFilter = request.nextUrl.searchParams.get("provider");

    const membershipOffer = and(
      eq(subscriptionOfferTable.slug, MEMBERSHIP_OFFER_SLUG),
    );

    const conditions = [membershipOffer];
    if (tierFilter && ["1", "2", "3"].includes(tierFilter)) {
      conditions.push(
        sql`${subscriptionPlanTable.metadata}->>'membershipTier' = ${tierFilter}`,
      );
    }
    if (providerFilter === "stripe" || providerFilter === "paypal") {
      conditions.push(
        eq(subscriptionInstanceTable.billingProvider, providerFilter),
      );
    }

    const whereClause = and(...conditions);

    const [{ count: totalCountRaw }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptionInstanceTable)
      .innerJoin(
        subscriptionOfferTable,
        eq(subscriptionInstanceTable.offerId, subscriptionOfferTable.id),
      )
      .innerJoin(
        subscriptionPlanTable,
        eq(subscriptionInstanceTable.planId, subscriptionPlanTable.id),
      )
      .where(whereClause);

    const totalCount = Number(totalCountRaw) || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const rows = await db
      .select({
        billingProvider: subscriptionInstanceTable.billingProvider,
        cancelAtPeriodEnd: subscriptionInstanceTable.cancelAtPeriodEnd,
        currentPeriodEnd: subscriptionInstanceTable.currentPeriodEnd,
        currentPeriodStart: subscriptionInstanceTable.currentPeriodStart,
        email: userTable.email,
        id: subscriptionInstanceTable.id,
        name: userTable.name,
        planMetadata: subscriptionPlanTable.metadata,
        status: subscriptionInstanceTable.status,
        userId: subscriptionInstanceTable.userId,
      })
      .from(subscriptionInstanceTable)
      .innerJoin(
        subscriptionOfferTable,
        eq(subscriptionInstanceTable.offerId, subscriptionOfferTable.id),
      )
      .innerJoin(
        subscriptionPlanTable,
        eq(subscriptionInstanceTable.planId, subscriptionPlanTable.id),
      )
      .innerJoin(userTable, eq(subscriptionInstanceTable.userId, userTable.id))
      .where(whereClause)
      .orderBy(desc(subscriptionInstanceTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const items: SubscriptionRow[] = rows.map((r) => {
      const m = r.planMetadata as null | {
        billingInterval?: string;
        membershipTier?: number;
      };
      const tier = typeof m?.membershipTier === "number" ? m.membershipTier : 0;
      const interval =
        typeof m?.billingInterval === "string" ? m.billingInterval : "";
      return {
        billingProvider: r.billingProvider,
        cancelAtPeriodEnd: r.cancelAtPeriodEnd,
        currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
        currentPeriodStart: r.currentPeriodStart?.toISOString() ?? null,
        email: r.email,
        id: r.id,
        interval,
        name: r.name,
        status: r.status,
        tier: tier || 0,
        tierName: TIER_NAMES[tier] ?? `Tier ${tier}`,
        userId: r.userId,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount,
      totalPages,
    } satisfies SubscriptionListResponse);
  } catch (err) {
    console.error("Admin membership subscriptions list error:", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Failed to load subscriptions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

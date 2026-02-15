import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable, ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim();
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    const conditions = [];
    if (
      statusFilter &&
      ["approved", "pending", "rejected", "suspended"].includes(statusFilter)
    ) {
      conditions.push(eq(affiliateTable.status, statusFilter));
    }
    if (search.length > 0) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(affiliateTable.code, term),
          ilike(affiliateTable.applicationNote, term),
          ilike(userTable.email, term),
          ilike(userTable.name, term),
        )!,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const affiliates = await db
      .select({
        applicationNote: affiliateTable.applicationNote,
        code: affiliateTable.code,
        commissionType: affiliateTable.commissionType,
        commissionValue: affiliateTable.commissionValue,
        createdAt: affiliateTable.createdAt,
        customerDiscountType: affiliateTable.customerDiscountType,
        customerDiscountValue: affiliateTable.customerDiscountValue,
        id: affiliateTable.id,
        payoutAddress: affiliateTable.payoutAddress,
        payoutMethod: affiliateTable.payoutMethod,
        status: affiliateTable.status,
        totalEarnedCents: affiliateTable.totalEarnedCents,
        totalPaidCents: affiliateTable.totalPaidCents,
        updatedAt: affiliateTable.updatedAt,
        userEmail: userTable.email,
        userId: affiliateTable.userId,
        userName: userTable.name,
      })
      .from(affiliateTable)
      .leftJoin(userTable, eq(affiliateTable.userId, userTable.id))
      .where(whereClause)
      .orderBy(desc(affiliateTable.createdAt))
      .limit(limit)
      .offset(offset);

    const affiliateIds = affiliates.map((a) => a.id).filter(Boolean);
    const conversionCounts =
      affiliateIds.length > 0
        ? await db
            .select({
              affiliateId: ordersTable.affiliateId,
              count: sql<number>`count(*)::int`,
            })
            .from(ordersTable)
            .where(inArray(ordersTable.affiliateId, affiliateIds))
            .groupBy(ordersTable.affiliateId)
        : [];

    const countMap = new Map(
      conversionCounts.map((r) => [r.affiliateId ?? "", r.count]),
    );

    const [countResult] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(affiliateTable)
      .leftJoin(userTable, eq(affiliateTable.userId, userTable.id))
      .where(whereClause);
    const total = countResult?.total ?? 0;

    const items = affiliates.map((a) => ({
      applicationNote: a.applicationNote,
      code: a.code,
      commissionType: a.commissionType,
      commissionValue: a.commissionValue,
      conversionCount: countMap.get(a.id) ?? 0,
      createdAt: a.createdAt,
      customerDiscountType: a.customerDiscountType,
      customerDiscountValue: a.customerDiscountValue,
      id: a.id,
      payoutAddress: a.payoutAddress,
      payoutMethod: a.payoutMethod,
      status: a.status,
      totalEarnedCents: a.totalEarnedCents,
      totalPaidCents: a.totalPaidCents,
      updatedAt: a.updatedAt,
      userEmail: a.userEmail,
      userId: a.userId,
      userName: a.userName,
    }));

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Admin affiliates list error:", err);
    return NextResponse.json(
      { error: "Failed to list affiliates" },
      { status: 500 },
    );
  }
}

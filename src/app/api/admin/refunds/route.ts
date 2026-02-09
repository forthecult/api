import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable, refundRequestsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STATUS_VALUES = ["requested", "approved", "refunded", "rejected"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

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
          request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;
    const statusParam =
      request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "";
    const statusFilter: StatusFilter | "" = STATUS_VALUES.includes(
      statusParam as StatusFilter,
    )
      ? (statusParam as StatusFilter)
      : "";
    const orderIdParam =
      request.nextUrl.searchParams.get("orderId")?.trim() ?? "";

    const conditions: ReturnType<typeof eq>[] = [];
    if (statusFilter) conditions.push(eq(refundRequestsTable.status, statusFilter));
    if (orderIdParam) conditions.push(eq(refundRequestsTable.orderId, orderIdParam));

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: refundRequestsTable.id,
          orderId: refundRequestsTable.orderId,
          status: refundRequestsTable.status,
          refundAddress: refundRequestsTable.refundAddress,
          createdAt: refundRequestsTable.createdAt,
          updatedAt: refundRequestsTable.updatedAt,
          orderEmail: ordersTable.email,
          orderTotalCents: ordersTable.totalCents,
          orderPaymentStatus: ordersTable.paymentStatus,
          orderPaymentMethod: ordersTable.paymentMethod,
        })
        .from(refundRequestsTable)
        .innerJoin(
          ordersTable,
          eq(refundRequestsTable.orderId, ordersTable.id),
        )
        .where(whereClause)
        .orderBy(desc(refundRequestsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refundRequestsTable)
        .where(whereClause),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        status: r.status,
        refundAddress: r.refundAddress ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        order: {
          email: r.orderEmail,
          totalCents: r.orderTotalCents,
          paymentStatus: r.orderPaymentStatus,
          paymentMethod: r.orderPaymentMethod,
        },
      })),
      page,
      limit,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin refunds GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

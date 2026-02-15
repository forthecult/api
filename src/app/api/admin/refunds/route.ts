import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable, refundRequestsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STATUS_VALUES = [
  "requested",
  "approved",
  "refunded",
  "rejected",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

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
    const statusParam =
      request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "";
    const statusFilter: "" | StatusFilter = STATUS_VALUES.includes(
      statusParam as StatusFilter,
    )
      ? (statusParam as StatusFilter)
      : "";
    const orderIdParam =
      request.nextUrl.searchParams.get("orderId")?.trim() ?? "";

    const conditions: ReturnType<typeof eq>[] = [];
    if (statusFilter)
      conditions.push(eq(refundRequestsTable.status, statusFilter));
    if (orderIdParam)
      conditions.push(eq(refundRequestsTable.orderId, orderIdParam));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          createdAt: refundRequestsTable.createdAt,
          id: refundRequestsTable.id,
          orderEmail: ordersTable.email,
          orderId: refundRequestsTable.orderId,
          orderPaymentMethod: ordersTable.paymentMethod,
          orderPaymentStatus: ordersTable.paymentStatus,
          orderTotalCents: ordersTable.totalCents,
          refundAddress: refundRequestsTable.refundAddress,
          status: refundRequestsTable.status,
          updatedAt: refundRequestsTable.updatedAt,
        })
        .from(refundRequestsTable)
        .innerJoin(ordersTable, eq(refundRequestsTable.orderId, ordersTable.id))
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
        createdAt: r.createdAt,
        id: r.id,
        order: {
          email: r.orderEmail,
          paymentMethod: r.orderPaymentMethod,
          paymentStatus: r.orderPaymentStatus,
          totalCents: r.orderTotalCents,
        },
        orderId: r.orderId,
        refundAddress: r.refundAddress ?? null,
        status: r.status,
        updatedAt: r.updatedAt,
      })),
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin refunds GET:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 },
    );
  }
}

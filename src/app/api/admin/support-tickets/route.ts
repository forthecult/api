import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportTicketTable,
  userTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const STATUS_VALUES = ["open", "pending", "closed"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const TYPE_VALUES = ["normal", "urgent"] as const;
type TypeFilter = (typeof TYPE_VALUES)[number];

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
    const statusParam = request.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? "";
    const statusFilter: StatusFilter | "" = STATUS_VALUES.includes(statusParam as StatusFilter)
      ? (statusParam as StatusFilter)
      : "";
    const typeParam = request.nextUrl.searchParams.get("type")?.trim().toLowerCase() ?? "";
    const typeFilter: TypeFilter | "" = TYPE_VALUES.includes(typeParam as TypeFilter)
      ? (typeParam as TypeFilter)
      : "";
    const fromDateParam = request.nextUrl.searchParams.get("fromDate")?.trim() ?? "";
    const toDateParam = request.nextUrl.searchParams.get("toDate")?.trim() ?? "";

    const conditions: ReturnType<typeof eq>[] = [];
    if (statusFilter) conditions.push(eq(supportTicketTable.status, statusFilter));
    if (typeFilter) conditions.push(eq(supportTicketTable.type, typeFilter));
    if (fromDateParam) {
      const from = new Date(fromDateParam);
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        conditions.push(gte(supportTicketTable.createdAt, from));
      }
    }
    if (toDateParam) {
      const to = new Date(toDateParam);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        conditions.push(lte(supportTicketTable.createdAt, to));
      }
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: supportTicketTable.id,
          subject: supportTicketTable.subject,
          message: supportTicketTable.message,
          status: supportTicketTable.status,
          type: supportTicketTable.type,
          createdAt: supportTicketTable.createdAt,
          updatedAt: supportTicketTable.updatedAt,
          userId: supportTicketTable.userId,
          userName: userTable.name,
          userEmail: userTable.email,
        })
        .from(supportTicketTable)
        .innerJoin(userTable, eq(supportTicketTable.userId, userTable.id))
        .where(whereClause)
        .orderBy(desc(supportTicketTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(supportTicketTable)
        .where(whereClause),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        message: r.message,
        status: r.status,
        type: r.type,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        customer: {
          id: r.userId,
          name: r.userName ?? "",
          email: r.userEmail ?? "",
        },
      })),
      page,
      limit,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin support-tickets GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

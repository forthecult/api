import { asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

/** Escape SQL LIKE/ILIKE special characters */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORT_BY_VALUES = [
  "name",
  "email",
  "tokenBalance",
  "orderCount",
  "amountSpent",
] as const;
type SortBy = (typeof SORT_BY_VALUES)[number];
const ORDER_VALUES = ["asc", "desc"] as const;
type Order = (typeof ORDER_VALUES)[number];

function parseSort(
  sortByParam: string | null,
  orderParam: string | null,
): { sortBy: SortBy; order: Order } {
  const sortBy = SORT_BY_VALUES.includes(sortByParam as SortBy)
    ? (sortByParam as SortBy)
    : "name";
  const order = ORDER_VALUES.includes(orderParam as Order)
    ? (orderParam as Order)
    : "asc";
  return { sortBy, order };
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
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const { sortBy, order } = parseSort(
      request.nextUrl.searchParams.get("sortBy"),
      request.nextUrl.searchParams.get("order"),
    );

    const term = search.length > 0 ? `%${escapeLike(search)}%` : "";
    const whereClause =
      search.length > 0
        ? or(
            ilike(userTable.name, term),
            ilike(userTable.email, term),
            ilike(userTable.firstName, term),
            ilike(userTable.lastName, term),
          )
        : undefined;

    const orderBy =
      sortBy === "name"
        ? order === "asc"
          ? [asc(userTable.name)]
          : [desc(userTable.name)]
        : sortBy === "email"
          ? order === "asc"
            ? [asc(userTable.email)]
            : [desc(userTable.email)]
          : sortBy === "tokenBalance"
            ? order === "asc"
              ? [asc(userTable.id)]
              : [desc(userTable.id)]
            : sortBy === "amountSpent"
              ? order === "asc"
                ? [
                    asc(
                      sql`(SELECT COALESCE(SUM(o.total_cents), 0) FROM "order" o WHERE o.user_id = ${userTable.id})`,
                    ),
                  ]
                : [
                    desc(
                      sql`(SELECT COALESCE(SUM(o.total_cents), 0) FROM "order" o WHERE o.user_id = ${userTable.id})`,
                    ),
                  ]
              : order === "asc"
                ? [
                    asc(
                      sql`(SELECT count(*)::int FROM "order" o WHERE o.user_id = ${userTable.id})`,
                    ),
                  ]
                : [
                    desc(
                      sql`(SELECT count(*)::int FROM "order" o WHERE o.user_id = ${userTable.id})`,
                    ),
                  ];

    const [users, countResult] = await Promise.all([
      db.query.userTable.findMany({
        where: whereClause,
        orderBy,
        columns: {
          id: true,
          name: true,
          image: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          receiveMarketing: true,
          receiveSmsMarketing: true,
        },
        limit,
        offset,
      }),
      whereClause !== undefined
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(userTable)
            .where(whereClause)
        : db.select({ count: sql<number>`count(*)::int` }).from(userTable),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const userIds = users.map((u) => u.id);
    const orderCounts =
      userIds.length > 0
        ? await db
            .select({
              userId: ordersTable.userId,
              count: sql<number>`count(*)::int`.as("count"),
            })
            .from(ordersTable)
            .where(inArray(ordersTable.userId, userIds))
            .groupBy(ordersTable.userId)
        : [];

    const countByUserId = new Map<string, number>();
    for (const row of orderCounts) {
      if (row.userId) countByUserId.set(row.userId, Number(row.count) || 0);
    }

    const totalSpentByUserId = new Map<string, number>();
    if (userIds.length > 0) {
      const spentRows = await db
        .select({
          userId: ordersTable.userId,
          totalSpent:
            sql<number>`COALESCE(SUM(${ordersTable.totalCents}), 0)::bigint`.as(
              "totalSpent",
            ),
        })
        .from(ordersTable)
        .where(inArray(ordersTable.userId, userIds))
        .groupBy(ordersTable.userId);
      for (const row of spentRows) {
        if (row.userId)
          totalSpentByUserId.set(row.userId, Number(row.totalSpent) || 0);
      }
    }

    // Latest order location per user using DISTINCT ON to avoid fetching all orders
    const recentOrders =
      userIds.length > 0
        ? await db.execute<{ user_id: string; shipping_city: string | null; shipping_country_code: string | null }>(sql`
            SELECT DISTINCT ON (user_id) user_id, shipping_city, shipping_country_code
            FROM "order"
            WHERE user_id = ANY(${userIds})
            ORDER BY user_id, created_at DESC
          `)
        : [];
    const locationByUserId = new Map<
      string,
      { city: string | null; country: string | null }
    >();
    for (const row of recentOrders) {
      if (row.user_id)
        locationByUserId.set(row.user_id, {
          city: row.shipping_city ?? null,
          country: row.shipping_country_code ?? null,
        });
    }

    const items = users.map((u) => {
      const loc = locationByUserId.get(u.id);
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        email: u.email,
        phone: u.phone,
        tokenBalanceCents: null as number | null,
        orderCount: countByUserId.get(u.id) ?? 0,
        amountSpentCents: totalSpentByUserId.get(u.id) ?? 0,
        city: loc?.city ?? null,
        country: loc?.country ?? null,
        receiveMarketing: u.receiveMarketing ?? false,
        receiveSmsMarketing: u.receiveSmsMarketing ?? false,
      };
    });

    return NextResponse.json({
      items,
      page,
      limit,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin customers list error:", err);
    return NextResponse.json(
      { error: "Failed to load customers" },
      { status: 500 },
    );
  }
}

import { asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

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
    const { order, sortBy } = parseSort(
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

    interface UserRow {
      email: string;
      firstName: null | string;
      id: string;
      image: null | string;
      lastName: null | string;
      name: string;
      phone: null | string;
      receiveMarketing: boolean;
      receiveSmsMarketing: boolean;
    }

    const runFullQuery = async (): Promise<UserRow[]> => {
      const rows = await db.query.userTable.findMany({
        columns: {
          email: true,
          firstName: true,
          id: true,
          image: true,
          lastName: true,
          name: true,
          phone: true,
          receiveMarketing: true,
          receiveSmsMarketing: true,
        },
        limit,
        offset,
        orderBy,
        where: whereClause,
      });
      return rows as UserRow[];
    };

    const runFallbackQuery = async (): Promise<UserRow[]> => {
      const baseSelect = db
        .select({
          email: userTable.email,
          firstName: userTable.firstName,
          id: userTable.id,
          image: userTable.image,
          lastName: userTable.lastName,
          name: userTable.name,
          phone: userTable.phone,
          receiveMarketing: userTable.receiveMarketing,
          receiveSmsMarketing: userTable.receiveSmsMarketing,
        })
        .from(userTable)
        .orderBy(
          ...(sortBy === "name"
            ? order === "asc"
              ? [asc(userTable.name)]
              : [desc(userTable.name)]
            : sortBy === "email"
              ? order === "asc"
                ? [asc(userTable.email)]
                : [desc(userTable.email)]
              : [asc(userTable.id)]),
        )
        .limit(limit)
        .offset(offset);
      const rows = whereClause
        ? await baseSelect.where(whereClause)
        : await baseSelect;
      return rows.map((r) => ({
        ...r,
        receiveMarketing: r.receiveMarketing ?? false,
        receiveSmsMarketing: r.receiveSmsMarketing ?? false,
      }));
    };

    const runMinimalFallbackQuery = async (): Promise<UserRow[]> => {
      const baseSelect = db
        .select({
          email: userTable.email,
          id: userTable.id,
          name: userTable.name,
        })
        .from(userTable)
        .orderBy(asc(userTable.name))
        .limit(limit)
        .offset(offset);
      const rows = whereClause
        ? await baseSelect.where(whereClause)
        : await baseSelect;
      return rows.map((r) => ({
        email: r.email,
        firstName: null,
        id: r.id,
        image: null,
        lastName: null,
        name: r.name,
        phone: null,
        receiveMarketing: false,
        receiveSmsMarketing: false,
      }));
    };

    let users: UserRow[];
    let countResult: { count: number }[];

    try {
      [users, countResult] = await Promise.all([
        runFullQuery(),
        whereClause !== undefined
          ? db
              .select({ count: sql<number>`count(*)::int` })
              .from(userTable)
              .where(whereClause)
          : db.select({ count: sql<number>`count(*)::int` }).from(userTable),
      ]);
    } catch (queryErr) {
      const msg =
        queryErr instanceof Error ? queryErr.message : String(queryErr);
      const mayBeSchemaError =
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("Failed query") ||
        msg.includes("column");
      if (mayBeSchemaError) {
        console.warn(
          "Admin customers: full query failed, trying fallback:",
          msg,
        );
        try {
          users = await runFallbackQuery();
        } catch (fallbackErr) {
          console.warn(
            "Admin customers: fallback failed, trying minimal:",
            fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
          );
          users = await runMinimalFallbackQuery();
        }
        countResult = whereClause
          ? await db
              .select({ count: sql<number>`count(*)::int` })
              .from(userTable)
              .where(whereClause)
          : await db
              .select({ count: sql<number>`count(*)::int` })
              .from(userTable);
      } else {
        throw queryErr;
      }
    }

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const userIds = users.map((u) => u.id);
    const orderCounts =
      userIds.length > 0
        ? await db
            .select({
              count: sql<number>`count(*)::int`.as("count"),
              userId: ordersTable.userId,
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
          totalSpent:
            sql<number>`COALESCE(SUM(${ordersTable.totalCents}), 0)::bigint`.as(
              "totalSpent",
            ),
          userId: ordersTable.userId,
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
        ? await db.execute<{
            shipping_city: null | string;
            shipping_country_code: null | string;
            user_id: string;
          }>(sql`
            SELECT DISTINCT ON (user_id) user_id, shipping_city, shipping_country_code
            FROM "order"
            WHERE user_id IN (${sql.join(
              userIds.map((id) => sql`${id}`),
              sql`, `,
            )})
            ORDER BY user_id, created_at DESC
          `)
        : [];
    const locationByUserId = new Map<
      string,
      { city: null | string; country: null | string }
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
        amountSpentCents: totalSpentByUserId.get(u.id) ?? 0,
        city: loc?.city ?? null,
        country: loc?.country ?? null,
        email: u.email,
        id: u.id,
        image: u.image,
        name: u.name,
        orderCount: countByUserId.get(u.id) ?? 0,
        phone: u.phone,
        receiveMarketing: u.receiveMarketing ?? false,
        receiveSmsMarketing: u.receiveSmsMarketing ?? false,
        tokenBalanceCents: null as null | number,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin customers list error:", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Failed to load customers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseSort(
  sortByParam: null | string,
  orderParam: null | string,
): { order: Order; sortBy: SortBy } {
  const sortBy = SORT_BY_VALUES.includes(sortByParam as SortBy)
    ? (sortByParam as SortBy)
    : "name";
  const order = ORDER_VALUES.includes(orderParam as Order)
    ? (orderParam as Order)
    : "asc";
  return { order, sortBy };
}

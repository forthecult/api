import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { orderItemsTable, ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/** Escape SQL LIKE/ILIKE special characters */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORT_BY_VALUES = ["date", "customer", "total", "items"] as const;
const PAYMENT_STATUS_VALUES = [
  "pending",
  "paid",
  "refund_pending",
  "refunded",
  "cancelled",
] as const;
const FULFILLMENT_STATUS_VALUES = [
  "unfulfilled",
  "on_hold",
  "partially_fulfilled",
  "fulfilled",
] as const;

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
    const sortByParam = request.nextUrl.searchParams
      .get("sortBy")
      ?.trim()
      ?.toLowerCase();
    const sortBy = SORT_BY_VALUES.includes(
      sortByParam as (typeof SORT_BY_VALUES)[number],
    )
      ? (sortByParam as (typeof SORT_BY_VALUES)[number])
      : "date";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.trim()
      ?.toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? asc : desc;
    const paymentFilter = request.nextUrl.searchParams
      .get("paymentStatus")
      ?.trim();
    const fulfillmentFilter = request.nextUrl.searchParams
      .get("fulfillmentStatus")
      ?.trim();
    const paymentStatusFilter =
      paymentFilter &&
      PAYMENT_STATUS_VALUES.includes(
        paymentFilter as (typeof PAYMENT_STATUS_VALUES)[number],
      )
        ? (paymentFilter as (typeof PAYMENT_STATUS_VALUES)[number])
        : null;
    const fulfillmentStatusFilter =
      fulfillmentFilter &&
      FULFILLMENT_STATUS_VALUES.includes(
        fulfillmentFilter as (typeof FULFILLMENT_STATUS_VALUES)[number],
      )
        ? (fulfillmentFilter as (typeof FULFILLMENT_STATUS_VALUES)[number])
        : null;

    let orderIdFilter: null | string[] = null;
    if (search.length > 0) {
      const term = `%${escapeLike(search)}%`;
      const [byOrder, byUser, byItem] = await Promise.all([
        db
          .selectDistinct({ id: ordersTable.id })
          .from(ordersTable)
          .where(
            or(ilike(ordersTable.id, term), ilike(ordersTable.email, term)),
          ),
        db
          .selectDistinct({ id: ordersTable.id })
          .from(ordersTable)
          .innerJoin(userTable, eq(ordersTable.userId, userTable.id))
          .where(
            or(
              ilike(userTable.name, term),
              ilike(userTable.firstName, term),
              ilike(userTable.lastName, term),
              ilike(userTable.email, term),
            ),
          ),
        db
          .selectDistinct({ orderId: orderItemsTable.orderId })
          .from(orderItemsTable)
          .where(ilike(orderItemsTable.name, term)),
      ]);
      const ids = new Set<string>();
      byOrder.forEach((r) => ids.add(r.id));
      byUser.forEach((r) => ids.add(r.id));
      byItem.forEach((r) => ids.add(r.orderId));
      orderIdFilter = ids.size > 0 ? Array.from(ids) : [];
    }

    const searchClause =
      orderIdFilter !== null
        ? orderIdFilter.length === 0
          ? and(sql`1 = 0`)
          : inArray(ordersTable.id, orderIdFilter)
        : undefined;

    const filterConditions: Parameters<typeof and>[0][] = [];
    if (searchClause !== undefined) filterConditions.push(searchClause);
    if (paymentStatusFilter)
      filterConditions.push(eq(ordersTable.paymentStatus, paymentStatusFilter));
    if (fulfillmentStatusFilter)
      filterConditions.push(
        eq(ordersTable.fulfillmentStatus, fulfillmentStatusFilter),
      );
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const orderByCustomer = sortBy === "customer";
    const baseSelect = {
      createdAt: ordersTable.createdAt,
      email: ordersTable.email,
      fulfillmentStatus: ordersTable.fulfillmentStatus,
      id: ordersTable.id,
      paymentStatus: ordersTable.paymentStatus,
      solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
      solanaPayReference: ordersTable.solanaPayReference,
      status: ordersTable.status,
      stripeCheckoutSessionId: ordersTable.stripeCheckoutSessionId,
      totalCents: ordersTable.totalCents,
      userId: ordersTable.userId,
    };

    const itemCountSubquery = db
      .select({
        itemCount:
          sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)::int`.as(
            "item_count",
          ),
        orderId: orderItemsTable.orderId,
      })
      .from(orderItemsTable)
      .groupBy(orderItemsTable.orderId)
      .as("item_counts");

    let orders: {
      createdAt: Date;
      email: string;
      fulfillmentStatus: null | string;
      id: string;
      paymentStatus: null | string;
      solanaPayDepositAddress: null | string;
      solanaPayReference: null | string;
      status: string;
      stripeCheckoutSessionId: null | string;
      totalCents: number;
      userId: null | string;
    }[];
    if (sortBy === "items") {
      const orderByItemCount = sortOrder(
        sql`COALESCE(${itemCountSubquery.itemCount}, 0)`,
      );
      orders = await db
        .select(baseSelect)
        .from(ordersTable)
        .leftJoin(
          itemCountSubquery,
          eq(ordersTable.id, itemCountSubquery.orderId),
        )
        .where(whereClause ?? undefined)
        .orderBy(orderByItemCount)
        .limit(limit)
        .offset(offset);
    } else if (sortBy === "customer") {
      const orderByCustomerExpr = sortOrder(
        sql`COALESCE(${userTable.name}, ${userTable.email}, ${ordersTable.email})`,
      );
      orders = await db
        .select(baseSelect)
        .from(ordersTable)
        .leftJoin(userTable, eq(ordersTable.userId, userTable.id))
        .where(whereClause ?? undefined)
        .orderBy(orderByCustomerExpr)
        .limit(limit)
        .offset(offset);
    } else {
      const orderByClause =
        sortBy === "total"
          ? sortOrder(ordersTable.totalCents)
          : sortOrder(ordersTable.createdAt);
      const baseQuery = db
        .select(baseSelect)
        .from(ordersTable)
        .where(whereClause ?? undefined)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);
      orders = await baseQuery;
    }

    const countResult = await (whereClause !== undefined
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(ordersTable)
          .where(whereClause)
      : db.select({ count: sql<number>`count(*)::int` }).from(ordersTable));
    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const orderIds = orders.map((o) => o.id);
    const itemsByOrder =
      orderIds.length > 0
        ? await db
            .select({
              id: orderItemsTable.id,
              name: orderItemsTable.name,
              orderId: orderItemsTable.orderId,
              priceCents: orderItemsTable.priceCents,
              quantity: orderItemsTable.quantity,
            })
            .from(orderItemsTable)
            .where(inArray(orderItemsTable.orderId, orderIds))
        : [];

    const userIds = [
      ...new Set(orders.map((o) => o.userId).filter(Boolean)),
    ] as string[];
    const users =
      userIds.length > 0
        ? await db
            .select({
              email: userTable.email,
              id: userTable.id,
              name: userTable.name,
            })
            .from(userTable)
            .where(inArray(userTable.id, userIds))
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const itemCountByOrder = new Map<string, number>();
    for (const i of itemsByOrder) {
      itemCountByOrder.set(
        i.orderId,
        (itemCountByOrder.get(i.orderId) ?? 0) + i.quantity,
      );
    }
    const itemsGroupedByOrder = new Map<string, typeof itemsByOrder>();
    for (const i of itemsByOrder) {
      const list = itemsGroupedByOrder.get(i.orderId) ?? [];
      list.push(i);
      itemsGroupedByOrder.set(i.orderId, list);
    }

    const items = orders.map((o) => {
      const user = o.userId ? userMap.get(o.userId) : null;
      const orderItems = itemsGroupedByOrder.get(o.id) ?? [];
      const itemCount = itemCountByOrder.get(o.id) ?? 0;
      const payment = o.paymentStatus ?? paymentStatusFromLegacy(o.status);
      const fulfillment =
        o.fulfillmentStatus ?? fulfillmentStatusFromLegacy(o.status);
      return {
        channel: channel(o),
        createdAt: o.createdAt.toISOString(),
        customer: user?.name ?? user?.email ?? o.email,
        date: o.createdAt.toISOString(),
        email: o.email,
        fulfillmentStatus: fulfillment,
        id: o.id,
        itemCount,
        items: orderItems.map((i) => ({
          id: i.id,
          name: i.name,
          priceCents: i.priceCents,
          quantity: i.quantity,
        })),
        paymentStatus: payment,
        status: o.status,
        tags: [] as string[],
        total: o.totalCents,
        totalCents: o.totalCents,
        userId: o.userId ?? undefined,
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
    console.error("Admin orders list error:", err);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 },
    );
  }
}

const BULK_DELETE_MAX_IDS = 100;

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { ids?: unknown };
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, BULK_DELETE_MAX_IDS);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Provide a non-empty array of order ids" },
        { status: 400 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, ids));
      await tx.delete(ordersTable).where(inArray(ordersTable.id, ids));
    });

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("Admin orders bulk delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      email?: string;
      userId?: null | string;
    };
    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim()
        : "draft@admin.local";
    let userId: null | string =
      typeof body.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : null;

    if (!userId && email !== "draft@admin.local") {
      const [user] = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, email))
        .limit(1);
      if (user) userId = user.id;
    }

    const now = new Date();
    const orderId = createId();

    await db.insert(ordersTable).values({
      createdAt: now,
      discountPercent: 0,
      email,
      fulfillmentStatus: "unfulfilled",
      id: orderId,
      paymentStatus: "pending",
      status: "pending",
      totalCents: 0,
      updatedAt: now,
      userId,
    });

    return NextResponse.json({ id: orderId });
  } catch (err) {
    console.error("Admin create order error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}

function channel(order: {
  solanaPayDepositAddress: null | string;
  solanaPayReference: null | string;
  stripeCheckoutSessionId: null | string;
}): string {
  if (order.stripeCheckoutSessionId) return "Stripe";
  if (order.solanaPayDepositAddress ?? order.solanaPayReference)
    return "Solana Pay";
  return "Manual";
}

/** Derive fulfillment status from legacy status when fulfillmentStatus is null. Orders that haven't shipped are unfulfilled. */
function fulfillmentStatusFromLegacy(status: string): string {
  if (status === "fulfilled") return "fulfilled";
  return "unfulfilled";
}

/** Derive payment status from legacy status when paymentStatus is null. */
function paymentStatusFromLegacy(status: string): string {
  if (status === "refund_pending") return "refund_pending";
  if (status === "refunded") return "refunded";
  if (status === "paid" || status === "fulfilled") return "paid";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

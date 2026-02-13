import { createId } from "@paralleldrive/cuid2";
import { asc, desc, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  couponCategoryTable,
  couponProductTable,
  couponRedemptionTable,
  couponsTable,
} from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

const SORT_COLUMNS = [
  "code",
  "dateStart",
  "dateEnd",
  "discountValue",
  "uses",
  "createdAt",
] as const;
type SortBy = (typeof SORT_COLUMNS)[number];

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const sortByParam = request.nextUrl.searchParams.get("sortBy")?.trim();
    const sortBy: SortBy =
      sortByParam && SORT_COLUMNS.includes(sortByParam as SortBy)
        ? (sortByParam as SortBy)
        : "createdAt";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.toLowerCase();
    const sortDir = sortOrderParam === "asc" ? "asc" : "desc";
    const sortOrder = sortDir === "asc" ? asc : desc;

    const orderByUses = sortBy === "uses";

    // Explicit select with only columns that exist in older DBs so we don't 500 when method, discount_kind, buy_quantity, etc. are missing.
    const sortColumn =
      sortBy === "code"
        ? couponsTable.code
        : sortBy === "dateStart"
          ? couponsTable.dateStart
          : sortBy === "dateEnd"
            ? couponsTable.dateEnd
            : sortBy === "discountValue"
              ? couponsTable.discountValue
              : couponsTable.createdAt;

    const couponRows = await db
      .select({
        id: couponsTable.id,
        method: couponsTable.method,
        code: couponsTable.code,
        dateStart: couponsTable.dateStart,
        dateEnd: couponsTable.dateEnd,
        discountKind: couponsTable.discountKind,
        discountType: couponsTable.discountType,
        discountValue: couponsTable.discountValue,
        appliesTo: couponsTable.appliesTo,
        buyQuantity: couponsTable.buyQuantity,
        getQuantity: couponsTable.getQuantity,
        getDiscountType: couponsTable.getDiscountType,
        getDiscountValue: couponsTable.getDiscountValue,
        maxUses: couponsTable.maxUses,
        maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
        maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
        createdAt: couponsTable.createdAt,
        updatedAt: couponsTable.updatedAt,
      })
      .from(couponsTable)
      .orderBy(orderByUses ? couponsTable.createdAt : sortOrder(sortColumn));

    const coupons = couponRows;

    const redemptionCounts =
      coupons.length > 0
        ? await db
            .select({
              couponId: couponRedemptionTable.couponId,
              count: sql<number>`count(*)::int`.as("count"),
            })
            .from(couponRedemptionTable)
            .where(
              inArray(
                couponRedemptionTable.couponId,
                coupons.map((c) => c.id),
              ),
            )
            .groupBy(couponRedemptionTable.couponId)
        : [];

    const countByCoupon = new Map(
      redemptionCounts.map((r) => [r.couponId, r.count]),
    );

    let items = coupons.map((c) => ({
      id: c.id,
      method: c.method ?? "code",
      code: c.code,
      dateStart: c.dateStart?.toISOString() ?? null,
      dateEnd: c.dateEnd?.toISOString() ?? null,
      discountKind: c.discountKind ?? "amount_off_order",
      discountType: c.discountType,
      discountValue: c.discountValue,
      appliesTo: c.appliesTo,
      buyQuantity: c.buyQuantity ?? null,
      getQuantity: c.getQuantity ?? null,
      getDiscountType: c.getDiscountType ?? null,
      getDiscountValue: c.getDiscountValue ?? null,
      maxUses: c.maxUses,
      maxUsesPerCustomer: c.maxUsesPerCustomer,
      maxUsesPerCustomerType: c.maxUsesPerCustomerType ?? null,
      redemptionCount: countByCoupon.get(c.id) ?? 0,
      createdAt: c.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: c.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    }));

    if (orderByUses) {
      items = [...items].sort((a, b) => {
        const diff = a.redemptionCount - b.redemptionCount;
        return sortDir === "asc" ? diff : -diff;
      });
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Admin coupons list error:", err);
    const message = err instanceof Error ? err.message : "";
    const hint =
      message && /column.*does not exist|Unknown column/i.test(message)
        ? " Run: bun run db:push (adds method, discount_kind, buy_quantity, etc.)"
        : "";
    return NextResponse.json(
      {
        error: "Failed to load discounts",
        ...(process.env.NODE_ENV === "development" && message
          ? { detail: message + hint }
          : {}),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      method?: "automatic" | "code";
      code?: string;
      dateStart?: string | null;
      dateEnd?: string | null;
      discountKind?:
        | "amount_off_products"
        | "amount_off_order"
        | "buy_x_get_y"
        | "free_shipping";
      discountType?: "percent" | "fixed";
      discountValue?: number;
      appliesTo?: "subtotal" | "shipping";
      buyQuantity?: number | null;
      getQuantity?: number | null;
      getDiscountType?: "percent" | "fixed" | null;
      getDiscountValue?: number | null;
      maxUses?: number | null;
      maxUsesPerCustomer?: number | null;
      maxUsesPerCustomerType?: "account" | "phone" | "shipping_address" | null;
      tokenHolderChain?: string | null;
      tokenHolderTokenAddress?: string | null;
      tokenHolderMinBalance?: string | null;
      categoryIds?: string[];
      productIds?: string[];
      rulePaymentMethodKey?: string | null;
      ruleSubtotalMinCents?: number | null;
      ruleSubtotalMaxCents?: number | null;
      ruleShippingMinCents?: number | null;
      ruleShippingMaxCents?: number | null;
      ruleProductCountMin?: number | null;
      ruleProductCountMax?: number | null;
      ruleOrderTotalMinCents?: number | null;
      ruleOrderTotalMaxCents?: number | null;
    };

    const method = body.method === "automatic" ? "automatic" : "code";
    const now = new Date();
    const id = createId();
    const codeRaw =
      method === "automatic"
        ? `AUTO-${id}`
        : typeof body.code === "string"
          ? body.code.trim().toUpperCase()
          : "";
    if (method === "code" && !codeRaw) {
      return NextResponse.json(
        { error: "code is required when method is Code" },
        { status: 400 },
      );
    }

    const discountKind =
      body.discountKind === "amount_off_products" ||
      body.discountKind === "buy_x_get_y" ||
      body.discountKind === "free_shipping"
        ? body.discountKind
        : "amount_off_order";
    const appliesTo =
      discountKind === "free_shipping"
        ? "shipping"
        : discountKind === "amount_off_products"
          ? "product"
          : "subtotal";

    const discountType = body.discountType === "fixed" ? "fixed" : "percent";
    const discountValue =
      typeof body.discountValue === "number" && body.discountValue >= 0
        ? Math.round(body.discountValue)
        : 0;
    if (discountKind !== "buy_x_get_y" && discountKind !== "free_shipping") {
      if (discountType === "percent" && discountValue > 100) {
        return NextResponse.json(
          { error: "discountValue for percent must be 0-100" },
          { status: 400 },
        );
      }
    }

    const dateStart = body.dateStart ? new Date(body.dateStart) : null;
    const dateEnd = body.dateEnd ? new Date(body.dateEnd) : null;

    const buyQuantity =
      discountKind === "buy_x_get_y" &&
      typeof body.buyQuantity === "number" &&
      body.buyQuantity > 0
        ? body.buyQuantity
        : null;
    const getQuantity =
      discountKind === "buy_x_get_y" &&
      typeof body.getQuantity === "number" &&
      body.getQuantity > 0
        ? body.getQuantity
        : null;
    const getDiscountType =
      discountKind === "buy_x_get_y" &&
      (body.getDiscountType === "percent" || body.getDiscountType === "fixed")
        ? body.getDiscountType
        : null;
    const getDiscountValue =
      discountKind === "buy_x_get_y" &&
      typeof body.getDiscountValue === "number" &&
      body.getDiscountValue >= 0
        ? Math.round(body.getDiscountValue)
        : null;

    await db.insert(couponsTable).values({
      id,
      method,
      code: codeRaw,
      dateStart,
      dateEnd,
      discountKind,
      discountType,
      discountValue,
      appliesTo,
      buyQuantity,
      getQuantity,
      getDiscountType,
      getDiscountValue,
      maxUses: body.maxUses ?? null,
      maxUsesPerCustomer: body.maxUsesPerCustomer ?? null,
      maxUsesPerCustomerType: body.maxUsesPerCustomerType ?? null,
      tokenHolderChain: body.tokenHolderChain ?? null,
      tokenHolderTokenAddress: body.tokenHolderTokenAddress ?? null,
      tokenHolderMinBalance: body.tokenHolderMinBalance ?? null,
      rulePaymentMethodKey: body.rulePaymentMethodKey ?? null,
      ruleSubtotalMinCents: body.ruleSubtotalMinCents ?? null,
      ruleSubtotalMaxCents: body.ruleSubtotalMaxCents ?? null,
      ruleShippingMinCents: body.ruleShippingMinCents ?? null,
      ruleShippingMaxCents: body.ruleShippingMaxCents ?? null,
      ruleProductCountMin: body.ruleProductCountMin ?? null,
      ruleProductCountMax: body.ruleProductCountMax ?? null,
      ruleOrderTotalMinCents: body.ruleOrderTotalMinCents ?? null,
      ruleOrderTotalMaxCents: body.ruleOrderTotalMaxCents ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const categoryIds = [...new Set((body.categoryIds ?? []).filter(Boolean))];
    for (const categoryId of categoryIds) {
      await db.insert(couponCategoryTable).values({ couponId: id, categoryId });
    }

    const productIds = [...new Set((body.productIds ?? []).filter(Boolean))];
    for (const productId of productIds) {
      await db.insert(couponProductTable).values({ couponId: id, productId });
    }

    return NextResponse.json(
      { id, method, code: codeRaw, discountKind },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin discount create error:", err);
    return NextResponse.json(
      { error: "Failed to create discount" },
      { status: 500 },
    );
  }
}

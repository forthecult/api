import { createId } from "@paralleldrive/cuid2";
import { asc, desc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { memberTierDiscountTable } from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

const SORT_COLUMNS = ["memberTier", "scope", "discountValue", "createdAt"] as const;
type SortBy = (typeof SORT_COLUMNS)[number];

const SCOPES = ["shipping", "order", "category", "product"] as const;
const DISCOUNT_TYPES = ["percent", "fixed"] as const;

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

    const sortColumn =
      sortBy === "memberTier"
        ? memberTierDiscountTable.memberTier
        : sortBy === "scope"
          ? memberTierDiscountTable.scope
          : sortBy === "discountValue"
            ? memberTierDiscountTable.discountValue
            : memberTierDiscountTable.createdAt;
    const orderFn = sortDir === "asc" ? asc : desc;

    const rows = await db
      .select()
      .from(memberTierDiscountTable)
      .orderBy(orderFn(sortColumn));

    const items = rows.map((r) => ({
      id: r.id,
      memberTier: r.memberTier,
      label: r.label ?? null,
      scope: r.scope,
      discountType: r.discountType,
      discountValue: r.discountValue,
      categoryId: r.categoryId ?? null,
      productId: r.productId ?? null,
      appliesToEsim: r.appliesToEsim ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Admin tier discounts list error:", err);
    return NextResponse.json(
      { error: "Failed to load tier discounts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      memberTier?: number;
      label?: string | null;
      scope?: string;
      discountType?: string;
      discountValue?: number;
      categoryId?: string | null;
      productId?: string | null;
      appliesToEsim?: number | null;
    };

    const memberTier =
      typeof body.memberTier === "number" &&
      body.memberTier >= 1 &&
      body.memberTier <= 4
        ? body.memberTier
        : 1;
    const scope: (typeof SCOPES)[number] = SCOPES.includes(
      body.scope as (typeof SCOPES)[number],
    )
      ? (body.scope as (typeof SCOPES)[number])
      : "order";
    const discountType: (typeof DISCOUNT_TYPES)[number] =
      DISCOUNT_TYPES.includes(body.discountType as (typeof DISCOUNT_TYPES)[number])
        ? (body.discountType as (typeof DISCOUNT_TYPES)[number])
        : "percent";
    const discountValue =
      typeof body.discountValue === "number" && body.discountValue >= 0
        ? Math.round(body.discountValue)
        : 0;

    if (discountType === "percent" && discountValue > 100) {
      return NextResponse.json(
        { error: "Percent discount must be 0–100" },
        { status: 400 },
      );
    }

    const categoryId =
      scope === "category" && typeof body.categoryId === "string" && body.categoryId.trim()
        ? body.categoryId.trim()
        : null;
    const productId =
      scope === "product" && typeof body.productId === "string" && body.productId.trim()
        ? body.productId.trim()
        : null;
    const appliesToEsim =
      scope === "product" && body.appliesToEsim === 1 ? 1 : null;

    const label =
      typeof body.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : null;

    const now = new Date();
    const id = createId();

    await db.insert(memberTierDiscountTable).values({
      id,
      memberTier,
      label,
      scope,
      discountType,
      discountValue,
      categoryId,
      productId,
      appliesToEsim,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { id, memberTier, scope, discountType, discountValue },
      { status: 201 },
    );
  } catch (err) {
    console.error("Admin tier discount create error:", err);
    return NextResponse.json(
      { error: "Failed to create tier discount" },
      { status: 500 },
    );
  }
}

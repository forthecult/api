import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandTable, shippingOptionsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const SORT_COLUMNS = [
  "name",
  "countryCode",
  "minOrderCents",
  "minQuantity",
  "minWeightGrams",
  "type",
  "amountCents",
  "priority",
  "brandName",
] as const;
type SortBy = (typeof SORT_COLUMNS)[number];

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sortByParam = request.nextUrl.searchParams.get("sortBy")?.trim();
    const sortBy: SortBy =
      sortByParam && SORT_COLUMNS.includes(sortByParam as SortBy)
        ? (sortByParam as SortBy)
        : "priority";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? asc : desc;
    const brandIdFilter = request.nextUrl.searchParams.get("brandId")?.trim() || null;
    const countryCodeFilter = request.nextUrl.searchParams.get("countryCode")?.trim() || null;

    const orderColumn =
      sortBy === "name"
        ? shippingOptionsTable.name
        : sortBy === "countryCode"
          ? shippingOptionsTable.countryCode
          : sortBy === "minOrderCents"
            ? shippingOptionsTable.minOrderCents
            : sortBy === "minQuantity"
              ? shippingOptionsTable.minQuantity
              : sortBy === "minWeightGrams"
                ? shippingOptionsTable.minWeightGrams
                : sortBy === "type"
                  ? shippingOptionsTable.type
                  : sortBy === "amountCents"
                    ? shippingOptionsTable.amountCents
                    : sortBy === "brandName"
                      ? brandTable.name
                      : shippingOptionsTable.priority;

    const baseQuery = db
      .select({
        id: shippingOptionsTable.id,
        name: shippingOptionsTable.name,
        countryCode: shippingOptionsTable.countryCode,
        minOrderCents: shippingOptionsTable.minOrderCents,
        maxOrderCents: shippingOptionsTable.maxOrderCents,
        minQuantity: shippingOptionsTable.minQuantity,
        maxQuantity: shippingOptionsTable.maxQuantity,
        minWeightGrams: shippingOptionsTable.minWeightGrams,
        maxWeightGrams: shippingOptionsTable.maxWeightGrams,
        type: shippingOptionsTable.type,
        amountCents: shippingOptionsTable.amountCents,
        additionalItemCents: shippingOptionsTable.additionalItemCents,
        priority: shippingOptionsTable.priority,
        speed: shippingOptionsTable.speed,
        createdAt: shippingOptionsTable.createdAt,
        updatedAt: shippingOptionsTable.updatedAt,
        brandId: shippingOptionsTable.brandId,
        sourceUrl: shippingOptionsTable.sourceUrl,
        estimatedDaysText: shippingOptionsTable.estimatedDaysText,
        brandName: brandTable.name,
      })
      .from(shippingOptionsTable)
      .leftJoin(brandTable, eq(shippingOptionsTable.brandId, brandTable.id));

    const conditions = [
      brandIdFilter ? eq(shippingOptionsTable.brandId, brandIdFilter) : null,
      countryCodeFilter ? eq(shippingOptionsTable.countryCode, countryCodeFilter) : null,
    ].filter(Boolean) as ReturnType<typeof eq>[];
    const filteredQuery = conditions.length
      ? baseQuery.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseQuery;
    const rows = await filteredQuery.orderBy(
      sortOrder(orderColumn),
      desc(shippingOptionsTable.createdAt),
    );

    const items = rows.map((o) => ({
      id: o.id,
      name: o.name,
      countryCode: o.countryCode,
      minOrderCents: o.minOrderCents,
      maxOrderCents: o.maxOrderCents,
      minQuantity: o.minQuantity,
      maxQuantity: o.maxQuantity,
      minWeightGrams: o.minWeightGrams,
      maxWeightGrams: o.maxWeightGrams,
      type: o.type,
      amountCents: o.amountCents,
      additionalItemCents: o.additionalItemCents ?? null,
      priority: o.priority,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      brandId: o.brandId,
      brandName: o.brandName ?? null,
      sourceUrl: o.sourceUrl ?? null,
      estimatedDaysText: o.estimatedDaysText ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Admin shipping options list error:", err);
    return NextResponse.json(
      { error: "Failed to load shipping options" },
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
      name: string;
      countryCode?: string | null;
      minOrderCents?: number | null;
      maxOrderCents?: number | null;
      minQuantity?: number | null;
      maxQuantity?: number | null;
      minWeightGrams?: number | null;
      maxWeightGrams?: number | null;
      type: "flat" | "per_item" | "flat_plus_per_item" | "free";
      amountCents?: number | null;
      additionalItemCents?: number | null;
      priority?: number;
      speed?: "standard" | "express";
      brandId?: string | null;
      sourceUrl?: string | null;
      estimatedDaysText?: string | null;
    };

    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { error: "name is required (non-empty string)" },
        { status: 400 },
      );
    }
    if (
      body.type !== "flat" &&
      body.type !== "per_item" &&
      body.type !== "flat_plus_per_item" &&
      body.type !== "free"
    ) {
      return NextResponse.json(
        { error: "type must be flat, per_item, flat_plus_per_item, or free" },
        { status: 400 },
      );
    }
    if (
      (body.type === "flat" || body.type === "per_item") &&
      (typeof body.amountCents !== "number" || body.amountCents < 0)
    ) {
      return NextResponse.json(
        {
          error:
            "amountCents is required (non-negative number) for flat/per_item",
        },
        { status: 400 },
      );
    }
    if (body.type === "flat_plus_per_item") {
      if (typeof body.amountCents !== "number" || body.amountCents < 0) {
        return NextResponse.json(
          { error: "amountCents (first item) is required and must be >= 0 for flat + per item" },
          { status: 400 },
        );
      }
      if (typeof body.additionalItemCents !== "number" || body.additionalItemCents < 0) {
        return NextResponse.json(
          { error: "additionalItemCents (each additional item) is required and must be >= 0 for flat + per item" },
          { status: 400 },
        );
      }
    }

    const now = new Date();
    const id = createId();
    const countryCode =
      typeof body.countryCode === "string" && body.countryCode.trim() === ""
        ? null
        : (body.countryCode ?? null);
    const amountCents =
      body.type === "free"
        ? null
        : typeof body.amountCents === "number"
          ? body.amountCents
          : 0;
    const additionalItemCents =
      body.type === "flat_plus_per_item" &&
      typeof body.additionalItemCents === "number" &&
      body.additionalItemCents >= 0
        ? body.additionalItemCents
        : null;

    const brandId =
      typeof body.brandId === "string" && body.brandId.trim() === ""
        ? null
        : (body.brandId ?? null);
    const sourceUrl =
      typeof body.sourceUrl === "string" && body.sourceUrl.trim() === ""
        ? null
        : (body.sourceUrl ?? null);
    const estimatedDaysText =
      typeof body.estimatedDaysText === "string" &&
      body.estimatedDaysText.trim() === ""
        ? null
        : (body.estimatedDaysText ?? null);

    const speed =
      body.speed === "express" ? "express" : "standard";

    await db.insert(shippingOptionsTable).values({
      id,
      name: body.name.trim(),
      countryCode,
      minOrderCents: body.minOrderCents ?? null,
      maxOrderCents: body.maxOrderCents ?? null,
      minQuantity: body.minQuantity ?? null,
      maxQuantity: body.maxQuantity ?? null,
      minWeightGrams: body.minWeightGrams ?? null,
      maxWeightGrams: body.maxWeightGrams ?? null,
      type: body.type,
      amountCents,
      additionalItemCents,
      priority: typeof body.priority === "number" ? body.priority : 0,
      speed,
      brandId,
      sourceUrl,
      estimatedDaysText,
      createdAt: now,
      updatedAt: now,
    });

    const [inserted] = await db
      .select()
      .from(shippingOptionsTable)
      .where(eq(shippingOptionsTable.id, id))
      .limit(1);

    if (!inserted) {
      return NextResponse.json(
        { error: "Failed to create shipping option" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: inserted.id,
      name: inserted.name,
      countryCode: inserted.countryCode,
      minOrderCents: inserted.minOrderCents,
      maxOrderCents: inserted.maxOrderCents,
      minQuantity: inserted.minQuantity,
      maxQuantity: inserted.maxQuantity,
      minWeightGrams: inserted.minWeightGrams,
      maxWeightGrams: inserted.maxWeightGrams,
      type: inserted.type,
      amountCents: inserted.amountCents,
      priority: inserted.priority,
      speed: inserted.speed ?? "standard",
      additionalItemCents: inserted.additionalItemCents ?? null,
      brandId: inserted.brandId,
      sourceUrl: inserted.sourceUrl,
      estimatedDaysText: inserted.estimatedDaysText,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  } catch (err) {
    console.error("Admin shipping option create error:", err);
    return NextResponse.json(
      { error: "Failed to create shipping option" },
      { status: 500 },
    );
  }
}

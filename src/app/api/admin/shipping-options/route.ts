import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { brandTable, shippingOptionsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const sortByParam = request.nextUrl.searchParams.get("sortBy")?.trim();
    const sortBy: SortBy =
      sortByParam && SORT_COLUMNS.includes(sortByParam as SortBy)
        ? (sortByParam as SortBy)
        : "priority";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? asc : desc;
    const brandIdFilter =
      request.nextUrl.searchParams.get("brandId")?.trim() || null;
    const countryCodeFilter =
      request.nextUrl.searchParams.get("countryCode")?.trim() || null;

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
        additionalItemCents: shippingOptionsTable.additionalItemCents,
        amountCents: shippingOptionsTable.amountCents,
        brandId: shippingOptionsTable.brandId,
        brandName: brandTable.name,
        countryCode: shippingOptionsTable.countryCode,
        createdAt: shippingOptionsTable.createdAt,
        estimatedDaysText: shippingOptionsTable.estimatedDaysText,
        id: shippingOptionsTable.id,
        maxOrderCents: shippingOptionsTable.maxOrderCents,
        maxQuantity: shippingOptionsTable.maxQuantity,
        maxWeightGrams: shippingOptionsTable.maxWeightGrams,
        minOrderCents: shippingOptionsTable.minOrderCents,
        minQuantity: shippingOptionsTable.minQuantity,
        minWeightGrams: shippingOptionsTable.minWeightGrams,
        name: shippingOptionsTable.name,
        priority: shippingOptionsTable.priority,
        sourceUrl: shippingOptionsTable.sourceUrl,
        speed: shippingOptionsTable.speed,
        type: shippingOptionsTable.type,
        updatedAt: shippingOptionsTable.updatedAt,
      })
      .from(shippingOptionsTable)
      .leftJoin(brandTable, eq(shippingOptionsTable.brandId, brandTable.id));

    const conditions = [
      brandIdFilter ? eq(shippingOptionsTable.brandId, brandIdFilter) : null,
      countryCodeFilter
        ? eq(shippingOptionsTable.countryCode, countryCodeFilter)
        : null,
    ].filter(Boolean) as ReturnType<typeof eq>[];
    const filteredQuery = conditions.length
      ? baseQuery.where(
          conditions.length === 1 ? conditions[0]! : and(...conditions),
        )
      : baseQuery;
    const rows = await filteredQuery.orderBy(
      sortOrder(orderColumn),
      desc(shippingOptionsTable.createdAt),
    );

    const items = rows.map((o) => ({
      additionalItemCents: o.additionalItemCents ?? null,
      amountCents: o.amountCents,
      brandId: o.brandId,
      brandName: o.brandName ?? null,
      countryCode: o.countryCode,
      createdAt: o.createdAt,
      estimatedDaysText: o.estimatedDaysText ?? null,
      id: o.id,
      maxOrderCents: o.maxOrderCents,
      maxQuantity: o.maxQuantity,
      maxWeightGrams: o.maxWeightGrams,
      minOrderCents: o.minOrderCents,
      minQuantity: o.minQuantity,
      minWeightGrams: o.minWeightGrams,
      name: o.name,
      priority: o.priority,
      sourceUrl: o.sourceUrl ?? null,
      type: o.type,
      updatedAt: o.updatedAt,
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      additionalItemCents?: null | number;
      amountCents?: null | number;
      brandId?: null | string;
      countryCode?: null | string;
      estimatedDaysText?: null | string;
      maxOrderCents?: null | number;
      maxQuantity?: null | number;
      maxWeightGrams?: null | number;
      minOrderCents?: null | number;
      minQuantity?: null | number;
      minWeightGrams?: null | number;
      name: string;
      priority?: number;
      sourceUrl?: null | string;
      speed?: "express" | "standard";
      type: "flat" | "flat_plus_per_item" | "free" | "per_item";
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
          {
            error:
              "amountCents (first item) is required and must be >= 0 for flat + per item",
          },
          { status: 400 },
        );
      }
      if (
        typeof body.additionalItemCents !== "number" ||
        body.additionalItemCents < 0
      ) {
        return NextResponse.json(
          {
            error:
              "additionalItemCents (each additional item) is required and must be >= 0 for flat + per item",
          },
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

    const speed = body.speed === "express" ? "express" : "standard";

    await db.insert(shippingOptionsTable).values({
      additionalItemCents,
      amountCents,
      brandId,
      countryCode,
      createdAt: now,
      estimatedDaysText,
      id,
      maxOrderCents: body.maxOrderCents ?? null,
      maxQuantity: body.maxQuantity ?? null,
      maxWeightGrams: body.maxWeightGrams ?? null,
      minOrderCents: body.minOrderCents ?? null,
      minQuantity: body.minQuantity ?? null,
      minWeightGrams: body.minWeightGrams ?? null,
      name: body.name.trim(),
      priority: typeof body.priority === "number" ? body.priority : 0,
      sourceUrl,
      speed,
      type: body.type,
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
      additionalItemCents: inserted.additionalItemCents ?? null,
      amountCents: inserted.amountCents,
      brandId: inserted.brandId,
      countryCode: inserted.countryCode,
      createdAt: inserted.createdAt,
      estimatedDaysText: inserted.estimatedDaysText,
      id: inserted.id,
      maxOrderCents: inserted.maxOrderCents,
      maxQuantity: inserted.maxQuantity,
      maxWeightGrams: inserted.maxWeightGrams,
      minOrderCents: inserted.minOrderCents,
      minQuantity: inserted.minQuantity,
      minWeightGrams: inserted.minWeightGrams,
      name: inserted.name,
      priority: inserted.priority,
      sourceUrl: inserted.sourceUrl,
      speed: inserted.speed ?? "standard",
      type: inserted.type,
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

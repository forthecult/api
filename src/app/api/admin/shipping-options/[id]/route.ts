import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { shippingOptionsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(shippingOptionsTable)
      .where(eq(shippingOptionsTable.id, id))
      .returning({ id: shippingOptionsTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Shipping option not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin shipping option delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete shipping option" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [row] = await db
      .select()
      .from(shippingOptionsTable)
      .where(eq(shippingOptionsTable.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Shipping option not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      additionalItemCents: row.additionalItemCents ?? null,
      amountCents: row.amountCents,
      brandId: row.brandId,
      countryCode: row.countryCode,
      createdAt: row.createdAt,
      estimatedDaysText: row.estimatedDaysText,
      id: row.id,
      maxOrderCents: row.maxOrderCents,
      maxQuantity: row.maxQuantity,
      maxWeightGrams: row.maxWeightGrams,
      minOrderCents: row.minOrderCents,
      minQuantity: row.minQuantity,
      minWeightGrams: row.minWeightGrams,
      name: row.name,
      priority: row.priority,
      sourceUrl: row.sourceUrl,
      speed: row.speed ?? "standard",
      type: row.type,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("Admin shipping option get error:", err);
    return NextResponse.json(
      { error: "Failed to load shipping option" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
      name?: string;
      priority?: number;
      sourceUrl?: null | string;
      speed?: "express" | "standard";
      type?: "flat" | "flat_plus_per_item" | "free" | "per_item";
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (body.countryCode !== undefined) {
      updates.countryCode =
        typeof body.countryCode === "string" && body.countryCode.trim() === ""
          ? null
          : (body.countryCode ?? null);
    }
    if (body.minOrderCents !== undefined)
      updates.minOrderCents = body.minOrderCents ?? null;
    if (body.maxOrderCents !== undefined)
      updates.maxOrderCents = body.maxOrderCents ?? null;
    if (body.minQuantity !== undefined)
      updates.minQuantity = body.minQuantity ?? null;
    if (body.maxQuantity !== undefined)
      updates.maxQuantity = body.maxQuantity ?? null;
    if (body.minWeightGrams !== undefined)
      updates.minWeightGrams = body.minWeightGrams ?? null;
    if (body.maxWeightGrams !== undefined)
      updates.maxWeightGrams = body.maxWeightGrams ?? null;
    if (
      body.type === "flat" ||
      body.type === "per_item" ||
      body.type === "flat_plus_per_item" ||
      body.type === "free"
    ) {
      updates.type = body.type;
      if (body.type === "free") {
        updates.amountCents = null;
        updates.additionalItemCents = null;
      } else if (
        typeof body.amountCents === "number" &&
        body.amountCents >= 0
      ) {
        updates.amountCents = body.amountCents;
        if (
          body.type === "flat_plus_per_item" &&
          typeof body.additionalItemCents === "number" &&
          body.additionalItemCents >= 0
        ) {
          updates.additionalItemCents = body.additionalItemCents;
        } else if (body.type !== "flat_plus_per_item") {
          updates.additionalItemCents = null;
        }
      }
    } else if (body.amountCents !== undefined) {
      updates.amountCents = body.amountCents ?? null;
    }
    if (
      body.additionalItemCents !== undefined &&
      body.type === "flat_plus_per_item"
    ) {
      updates.additionalItemCents = body.additionalItemCents ?? null;
    }
    if (typeof body.priority === "number") updates.priority = body.priority;
    if (body.speed === "standard" || body.speed === "express") {
      updates.speed = body.speed;
    }
    if (body.brandId !== undefined) {
      updates.brandId =
        typeof body.brandId === "string" && body.brandId.trim() === ""
          ? null
          : (body.brandId ?? null);
    }
    if (body.sourceUrl !== undefined) {
      updates.sourceUrl =
        typeof body.sourceUrl === "string" && body.sourceUrl.trim() === ""
          ? null
          : (body.sourceUrl ?? null);
    }
    if (body.estimatedDaysText !== undefined) {
      updates.estimatedDaysText =
        typeof body.estimatedDaysText === "string" &&
        body.estimatedDaysText.trim() === ""
          ? null
          : (body.estimatedDaysText ?? null);
    }

    const [updated] = await db
      .update(shippingOptionsTable)
      .set(updates as Record<string, unknown>)
      .where(eq(shippingOptionsTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Shipping option not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      additionalItemCents: updated.additionalItemCents ?? null,
      amountCents: updated.amountCents,
      brandId: updated.brandId,
      countryCode: updated.countryCode,
      createdAt: updated.createdAt,
      estimatedDaysText: updated.estimatedDaysText,
      id: updated.id,
      maxOrderCents: updated.maxOrderCents,
      maxQuantity: updated.maxQuantity,
      maxWeightGrams: updated.maxWeightGrams,
      minOrderCents: updated.minOrderCents,
      minQuantity: updated.minQuantity,
      minWeightGrams: updated.minWeightGrams,
      name: updated.name,
      priority: updated.priority,
      sourceUrl: updated.sourceUrl,
      speed: updated.speed ?? "standard",
      type: updated.type,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    console.error("Admin shipping option update error:", err);
    return NextResponse.json(
      { error: "Failed to update shipping option" },
      { status: 500 },
    );
  }
}

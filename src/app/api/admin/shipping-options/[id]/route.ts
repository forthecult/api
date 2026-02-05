import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { shippingOptionsTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      id: row.id,
      name: row.name,
      countryCode: row.countryCode,
      minOrderCents: row.minOrderCents,
      maxOrderCents: row.maxOrderCents,
      minQuantity: row.minQuantity,
      maxQuantity: row.maxQuantity,
      minWeightGrams: row.minWeightGrams,
      maxWeightGrams: row.maxWeightGrams,
      type: row.type,
      amountCents: row.amountCents,
      priority: row.priority,
      brandId: row.brandId,
      sourceUrl: row.sourceUrl,
      estimatedDaysText: row.estimatedDaysText,
      createdAt: row.createdAt,
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
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      countryCode?: string | null;
      minOrderCents?: number | null;
      maxOrderCents?: number | null;
      minQuantity?: number | null;
      maxQuantity?: number | null;
      minWeightGrams?: number | null;
      maxWeightGrams?: number | null;
      type?: "flat" | "per_item" | "free";
      amountCents?: number | null;
      priority?: number;
      brandId?: string | null;
      sourceUrl?: string | null;
      estimatedDaysText?: string | null;
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
      body.type === "free"
    ) {
      updates.type = body.type;
      if (body.type === "free") {
        updates.amountCents = null;
      } else if (
        typeof body.amountCents === "number" &&
        body.amountCents >= 0
      ) {
        updates.amountCents = body.amountCents;
      }
    } else if (body.amountCents !== undefined) {
      updates.amountCents = body.amountCents ?? null;
    }
    if (typeof body.priority === "number") updates.priority = body.priority;
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
      id: updated.id,
      name: updated.name,
      countryCode: updated.countryCode,
      minOrderCents: updated.minOrderCents,
      maxOrderCents: updated.maxOrderCents,
      minQuantity: updated.minQuantity,
      maxQuantity: updated.maxQuantity,
      minWeightGrams: updated.minWeightGrams,
      maxWeightGrams: updated.maxWeightGrams,
      type: updated.type,
      amountCents: updated.amountCents,
      priority: updated.priority,
      brandId: updated.brandId,
      sourceUrl: updated.sourceUrl,
      estimatedDaysText: updated.estimatedDaysText,
      createdAt: updated.createdAt,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { memberTierDiscountTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const SCOPES = ["shipping", "order", "category", "product"] as const;
const DISCOUNT_TYPES = ["percent", "fixed"] as const;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;

    const [deleted] = await db
      .delete(memberTierDiscountTable)
      .where(eq(memberTierDiscountTable.id, id))
      .returning({ id: memberTierDiscountTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Tier discount not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin tier discount delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete tier discount" },
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [row] = await db
      .select()
      .from(memberTierDiscountTable)
      .where(eq(memberTierDiscountTable.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Tier discount not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      appliesToEsim: row.appliesToEsim ?? null,
      categoryId: row.categoryId ?? null,
      createdAt: row.createdAt.toISOString(),
      discountType: row.discountType,
      discountValue: row.discountValue,
      id: row.id,
      label: row.label ?? null,
      memberTier: row.memberTier,
      productId: row.productId ?? null,
      scope: row.scope,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Admin tier discount get error:", err);
    return NextResponse.json(
      { error: "Failed to load tier discount" },
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const body = (await request.json()) as {
      appliesToEsim?: null | number;
      categoryId?: null | string;
      discountType?: string;
      discountValue?: number;
      label?: null | string;
      memberTier?: number;
      productId?: null | string;
      scope?: string;
    };

    const [existing] = await db
      .select()
      .from(memberTierDiscountTable)
      .where(eq(memberTierDiscountTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Tier discount not found" },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (
      typeof body.memberTier === "number" &&
      body.memberTier >= 1 &&
      body.memberTier <= 4
    ) {
      updates.memberTier = body.memberTier;
    }
    if (body.label !== undefined) {
      updates.label =
        typeof body.label === "string" && body.label.trim().length > 0
          ? body.label.trim()
          : null;
    }
    if (
      body.scope !== undefined &&
      SCOPES.includes(body.scope as (typeof SCOPES)[number])
    ) {
      updates.scope = body.scope;
    }
    if (
      body.discountType !== undefined &&
      DISCOUNT_TYPES.includes(
        body.discountType as (typeof DISCOUNT_TYPES)[number],
      )
    ) {
      updates.discountType = body.discountType;
    }
    if (typeof body.discountValue === "number" && body.discountValue >= 0) {
      updates.discountValue = Math.round(body.discountValue);
    }
    if (body.categoryId !== undefined) {
      updates.categoryId =
        typeof body.categoryId === "string" && body.categoryId.trim()
          ? body.categoryId.trim()
          : null;
    }
    if (body.productId !== undefined) {
      updates.productId =
        typeof body.productId === "string" && body.productId.trim()
          ? body.productId.trim()
          : null;
    }
    if (body.appliesToEsim !== undefined) {
      updates.appliesToEsim = body.appliesToEsim === 1 ? 1 : null;
    }

    await db
      .update(memberTierDiscountTable)
      .set(updates as Record<string, unknown>)
      .where(eq(memberTierDiscountTable.id, id));

    const [updated] = await db
      .select()
      .from(memberTierDiscountTable)
      .where(eq(memberTierDiscountTable.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json(
        { error: "Tier discount not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      appliesToEsim: updated.appliesToEsim ?? null,
      categoryId: updated.categoryId ?? null,
      createdAt: updated.createdAt.toISOString(),
      discountType: updated.discountType,
      discountValue: updated.discountValue,
      id: updated.id,
      label: updated.label ?? null,
      memberTier: updated.memberTier,
      productId: updated.productId ?? null,
      scope: updated.scope,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Admin tier discount update error:", err);
    return NextResponse.json(
      { error: "Failed to update tier discount" },
      { status: 500 },
    );
  }
}

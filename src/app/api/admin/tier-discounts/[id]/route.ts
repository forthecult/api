import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { memberTierDiscountTable } from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

const SCOPES = ["shipping", "order", "category", "product"] as const;
const DISCOUNT_TYPES = ["percent", "fixed"] as const;

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
      id: row.id,
      memberTier: row.memberTier,
      label: row.label ?? null,
      scope: row.scope,
      discountType: row.discountType,
      discountValue: row.discountValue,
      categoryId: row.categoryId ?? null,
      productId: row.productId ?? null,
      appliesToEsim: row.appliesToEsim ?? null,
      createdAt: row.createdAt.toISOString(),
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
      memberTier?: number;
      label?: string | null;
      scope?: string;
      discountType?: string;
      discountValue?: number;
      categoryId?: string | null;
      productId?: string | null;
      appliesToEsim?: number | null;
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
    if (body.scope !== undefined && SCOPES.includes(body.scope as (typeof SCOPES)[number])) {
      updates.scope = body.scope;
    }
    if (body.discountType !== undefined && DISCOUNT_TYPES.includes(body.discountType as (typeof DISCOUNT_TYPES)[number])) {
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
      id: updated.id,
      memberTier: updated.memberTier,
      label: updated.label ?? null,
      scope: updated.scope,
      discountType: updated.discountType,
      discountValue: updated.discountValue,
      categoryId: updated.categoryId ?? null,
      productId: updated.productId ?? null,
      appliesToEsim: updated.appliesToEsim ?? null,
      createdAt: updated.createdAt.toISOString(),
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

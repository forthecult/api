import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { categoryAutoAssignRuleTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/**
 * DELETE /api/admin/categories/[id]/auto-assign-rule?ruleId=xxx
 * Deletes one perpetual rule by id (must belong to this category).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: categoryId } = await params;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("ruleId")?.trim();
    if (!ruleId) {
      return NextResponse.json(
        { error: "ruleId query parameter is required" },
        { status: 400 },
      );
    }

    const [deleted] = await db
      .delete(categoryAutoAssignRuleTable)
      .where(
        and(
          eq(categoryAutoAssignRuleTable.id, ruleId),
          eq(categoryAutoAssignRuleTable.categoryId, categoryId),
        ),
      )
      .returning({ id: categoryAutoAssignRuleTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Rule not found or does not belong to this category" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete auto-assign rule error:", err);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/categories/[id]/auto-assign-rule
 * Returns all perpetual auto-assign rules for this category.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: categoryId } = await params;
    const rules = await db
      .select({
        brand: categoryAutoAssignRuleTable.brand,
        categoryId: categoryAutoAssignRuleTable.categoryId,
        createdWithinDays: categoryAutoAssignRuleTable.createdWithinDays,
        enabled: categoryAutoAssignRuleTable.enabled,
        id: categoryAutoAssignRuleTable.id,
        tagContains: categoryAutoAssignRuleTable.tagContains,
        titleContains: categoryAutoAssignRuleTable.titleContains,
      })
      .from(categoryAutoAssignRuleTable)
      .where(eq(categoryAutoAssignRuleTable.categoryId, categoryId));

    return NextResponse.json({ rules });
  } catch (err) {
    console.error("Get auto-assign rule error:", err);
    return NextResponse.json(
      { error: "Failed to load auto-assign rule" },
      { status: 500 },
    );
  }
}

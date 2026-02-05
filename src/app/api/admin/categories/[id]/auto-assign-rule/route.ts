import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { categoryAutoAssignRuleTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

/**
 * GET /api/admin/categories/[id]/auto-assign-rule
 * Returns all perpetual auto-assign rules for this category.
 */
export async function GET(
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

    const { id: categoryId } = await params;
    const rules = await db
      .select({
        id: categoryAutoAssignRuleTable.id,
        categoryId: categoryAutoAssignRuleTable.categoryId,
        titleContains: categoryAutoAssignRuleTable.titleContains,
        createdWithinDays: categoryAutoAssignRuleTable.createdWithinDays,
        brand: categoryAutoAssignRuleTable.brand,
        tagContains: categoryAutoAssignRuleTable.tagContains,
        enabled: categoryAutoAssignRuleTable.enabled,
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

/**
 * DELETE /api/admin/categories/[id]/auto-assign-rule?ruleId=xxx
 * Deletes one perpetual rule by id (must belong to this category).
 */
export async function DELETE(
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

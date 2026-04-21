import type { NextRequest } from "next/server";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { sizeChartsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { apiError } from "~/lib/api-error";

const _PROVIDERS = ["printful", "printify", "manual"] as const;

/**
 * DELETE /api/admin/size-charts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const [deleted] = await db
    .delete(sizeChartsTable)
    .where(eq(sizeChartsTable.id, id))
    .returning({ id: sizeChartsTable.id });
  if (!deleted)
    return apiError("NOT_FOUND", { message: "Size chart not found" });
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /api/admin/size-charts/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const [chart] = await db
    .select()
    .from(sizeChartsTable)
    .where(eq(sizeChartsTable.id, id))
    .limit(1);
  if (!chart) return apiError("NOT_FOUND", { message: "Size chart not found" });
  return NextResponse.json(chart);
}

/**
 * PATCH /api/admin/size-charts/[id]
 * Body: { displayName?, dataImperial?, dataMetric? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const body = (await request.json()) as {
    dataImperial?: unknown;
    dataMetric?: unknown;
    displayName?: string;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.displayName !== undefined)
    updates.displayName = body.displayName?.trim() ?? null;
  if (body.dataImperial !== undefined)
    updates.dataImperial =
      body.dataImperial != null ? JSON.stringify(body.dataImperial) : null;
  if (body.dataMetric !== undefined)
    updates.dataMetric =
      body.dataMetric != null ? JSON.stringify(body.dataMetric) : null;

  const [updated] = await db
    .update(sizeChartsTable)
    .set(updates as Record<string, unknown>)
    .where(eq(sizeChartsTable.id, id))
    .returning();
  if (!updated)
    return apiError("NOT_FOUND", { message: "Size chart not found" });
  return NextResponse.json(updated);
}

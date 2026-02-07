import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { sizeChartsTable } from "~/db/schema";
import { requireAdmin } from "~/lib/api-auth";
import { apiError } from "~/lib/api-error";

const PROVIDERS = ["printful", "printify", "manual"] as const;

/**
 * GET /api/admin/size-charts/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const [chart] = await db.select().from(sizeChartsTable).where(eq(sizeChartsTable.id, id)).limit(1);
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
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const body = (await request.json()) as {
    displayName?: string;
    dataImperial?: unknown;
    dataMetric?: unknown;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.displayName !== undefined) updates.displayName = body.displayName?.trim() ?? null;
  if (body.dataImperial !== undefined) updates.dataImperial = body.dataImperial != null ? JSON.stringify(body.dataImperial) : null;
  if (body.dataMetric !== undefined) updates.dataMetric = body.dataMetric != null ? JSON.stringify(body.dataMetric) : null;

  const [updated] = await db
    .update(sizeChartsTable)
    .set(updates as Record<string, unknown>)
    .where(eq(sizeChartsTable.id, id))
    .returning();
  if (!updated) return apiError("NOT_FOUND", { message: "Size chart not found" }, 404);
  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/size-charts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return apiError("MISSING_REQUIRED_FIELD", { field: "id" });

  const [deleted] = await db.delete(sizeChartsTable).where(eq(sizeChartsTable.id, id)).returning({ id: sizeChartsTable.id });
  if (!deleted) return apiError("NOT_FOUND", { message: "Size chart not found" });
  return new NextResponse(null, { status: 204 });
}

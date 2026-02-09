import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { refundRequestsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const ALLOWED_STATUSES = [
  "requested",
  "approved",
  "refunded",
  "rejected",
] as const;

/**
 * PATCH /api/admin/refunds/[id]
 * Update refund request status (admin only).
 */
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
    if (!id) {
      return NextResponse.json(
        { error: "Missing refund request id" },
        { status: 400 },
      );
    }

    let body: { status?: string };
    try {
      body = (await request.json()) as { status?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const status =
      typeof body.status === "string" &&
      ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])
        ? (body.status as (typeof ALLOWED_STATUSES)[number])
        : undefined;
    if (status === undefined) {
      return NextResponse.json(
        {
          error: `status required; one of: ${ALLOWED_STATUSES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: refundRequestsTable.id })
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Refund request not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    await db
      .update(refundRequestsTable)
      .set({ status, updatedAt: now })
      .where(eq(refundRequestsTable.id, id));

    return NextResponse.json({ status, updatedAt: now.toISOString() });
  } catch (err) {
    console.error("Admin refunds [id] PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

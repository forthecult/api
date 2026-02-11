import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { refundRequestsTable } from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    // TODO: Standardize error response format across admin routes (L20)
    const CUID_RE = /^[a-z0-9]{20,30}$/;
    if (!id || !CUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid or missing refund request id" },
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

    console.info(`[admin-audit] Refund ${id} status changed to ${status} via admin API`);

    return NextResponse.json({ status, updatedAt: now.toISOString() });
  } catch (err) {
    console.error("Admin refunds [id] PATCH:", err);
    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500 },
    );
  }
}

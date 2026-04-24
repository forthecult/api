import { desc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { emailSuppressionTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { removeSuppression } from "~/lib/email/suppression";

/**
 * DELETE /api/admin/email/suppression?email=user@example.com
 */
export async function DELETE(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) return adminAuthFailureResponse(auth);

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "email query required" },
      { status: 400 },
    );
  }

  await removeSuppression(email);
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/admin/email/suppression?limit=100
 */
export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) return adminAuthFailureResponse(auth);

  const limit = Math.min(
    200,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "80", 10),
    ),
  );

  const rows = await db
    .select({
      createdAt: emailSuppressionTable.createdAt,
      email: emailSuppressionTable.email,
      notes: emailSuppressionTable.notes,
      reason: emailSuppressionTable.reason,
      source: emailSuppressionTable.source,
    })
    .from(emailSuppressionTable)
    .orderBy(desc(emailSuppressionTable.createdAt))
    .limit(limit);

  return NextResponse.json({ items: rows });
}

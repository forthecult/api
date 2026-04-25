import { count, desc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { emailEventTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const MAX = 100;

/**
 * GET /api/admin/email/events?limit=50
 */
export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) return adminAuthFailureResponse(auth);

  const limit = Math.min(
    MAX,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "40", 10),
    ),
  );

  const rows = await db
    .select({
      createdAt: emailEventTable.createdAt,
      id: emailEventTable.id,
      kind: emailEventTable.kind,
      resendId: emailEventTable.resendId,
      status: emailEventTable.status,
      subject: emailEventTable.subject,
      toEmail: emailEventTable.toEmail,
      userId: emailEventTable.userId,
    })
    .from(emailEventTable)
    .orderBy(desc(emailEventTable.createdAt))
    .limit(limit);

  const [countRow] = await db.select({ n: count() }).from(emailEventTable);

  return NextResponse.json({
    items: rows,
    totalApprox: Number(countRow?.n ?? 0),
  });
}

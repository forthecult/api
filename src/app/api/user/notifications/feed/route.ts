import { desc, eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { userNotificationTable } from "~/db/schema";
import { verifyCsrfOrigin, csrfFailureResponse } from "~/lib/csrf";
import { auth } from "~/lib/auth";
import { getClientIp, RATE_LIMITS, checkRateLimit, rateLimitResponse } from "~/lib/rate-limit";

const DEFAULT_LIMIT = 50;

/**
 * GET /api/user/notifications/feed
 * List in-app notifications for the current user (for the notification widget).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-notifications-feed:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT,
    100,
  );

  const rows = await db
    .select({
      id: userNotificationTable.id,
      type: userNotificationTable.type,
      title: userNotificationTable.title,
      description: userNotificationTable.description,
      read: userNotificationTable.read,
      metadata: userNotificationTable.metadata,
      createdAt: userNotificationTable.createdAt,
    })
    .from(userNotificationTable)
    .where(eq(userNotificationTable.userId, session.user.id))
    .orderBy(desc(userNotificationTable.createdAt))
    .limit(limit);

  return NextResponse.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      read: r.read,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/**
 * PATCH /api/user/notifications/feed
 * Body: { markAsRead?: string, markAllAsRead?: boolean }
 * Mark one notification as read by id, or all as read.
 */
export async function PATCH(request: NextRequest) {
  // [SECURITY] Verify Origin header to prevent CSRF attacks
  if (!verifyCsrfOrigin(request.headers)) return csrfFailureResponse();
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-notifications-feed:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { markAsRead?: string; markAllAsRead?: boolean };
  try {
    body = (await request.json()) as { markAsRead?: string; markAllAsRead?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.markAllAsRead) {
    await db
      .update(userNotificationTable)
      .set({ read: true })
      .where(eq(userNotificationTable.userId, session.user.id));
    return NextResponse.json({ updated: true });
  }

  if (body.markAsRead && typeof body.markAsRead === "string") {
    await db
      .update(userNotificationTable)
      .set({ read: true })
      .where(
        and(
          eq(userNotificationTable.id, body.markAsRead),
          eq(userNotificationTable.userId, session.user.id),
        ),
      );
    return NextResponse.json({ updated: true });
  }

  return NextResponse.json({ updated: false });
}

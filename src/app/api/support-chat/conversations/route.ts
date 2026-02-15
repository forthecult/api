import { desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatConversationTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "~/lib/rate-limit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const GUEST_ID_HEADER = "x-support-guest-id";
const GUEST_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/support-chat/conversations
 * Returns conversations for the current user (session) or guest (X-Support-Guest-Id).
 * Query params: page (default 1), limit (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
    ),
  );
  const offset = (page - 1) * limit;

  try {
    if (session?.user?.id) {
      const [list, countResult] = await Promise.all([
        db
          .select({
            createdAt: supportChatConversationTable.createdAt,
            id: supportChatConversationTable.id,
            status: supportChatConversationTable.status,
            takenOverBy: supportChatConversationTable.takenOverBy,
            updatedAt: supportChatConversationTable.updatedAt,
          })
          .from(supportChatConversationTable)
          .where(eq(supportChatConversationTable.userId, session.user.id))
          .orderBy(desc(supportChatConversationTable.updatedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportChatConversationTable)
          .where(eq(supportChatConversationTable.userId, session.user.id)),
      ]);
      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit) || 1;
      return NextResponse.json({
        conversations: list,
        pagination: { limit, page, total, totalPages },
      });
    }

    const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();
    if (guestId && GUEST_ID_REGEX.test(guestId)) {
      const [list, countResult] = await Promise.all([
        db
          .select({
            createdAt: supportChatConversationTable.createdAt,
            id: supportChatConversationTable.id,
            status: supportChatConversationTable.status,
            takenOverBy: supportChatConversationTable.takenOverBy,
            updatedAt: supportChatConversationTable.updatedAt,
          })
          .from(supportChatConversationTable)
          .where(eq(supportChatConversationTable.guestId, guestId))
          .orderBy(desc(supportChatConversationTable.updatedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(supportChatConversationTable)
          .where(eq(supportChatConversationTable.guestId, guestId)),
      ]);
      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit) || 1;
      return NextResponse.json({
        conversations: list,
        pagination: { limit, page, total, totalPages },
      });
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch (err) {
    console.error("Support chat conversations GET:", err);
    return NextResponse.json(
      { error: "Failed to load conversations." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/support-chat/conversations
 * Create a new conversation. Auth: session user or guest (X-Support-Guest-Id, rate-limited).
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (session?.user?.id) {
    const id = crypto.randomUUID();
    const now = new Date();
    try {
      await db.insert(supportChatConversationTable).values({
        createdAt: now,
        id,
        status: "open",
        updatedAt: now,
        userId: session.user.id,
      });
      return NextResponse.json({
        createdAt: now.toISOString(),
        id,
        status: "open",
        takenOverBy: null,
        updatedAt: now.toISOString(),
      });
    } catch (err) {
      console.error("Support chat conversation create:", err);
      return NextResponse.json(
        { error: "Failed to create conversation." },
        { status: 500 },
      );
    }
  }

  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();
  if (!guestId || !GUEST_ID_REGEX.test(guestId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`chat-create:${ip}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!rl.success) return rateLimitResponse(rl);

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.insert(supportChatConversationTable).values({
      createdAt: now,
      guestId,
      id,
      status: "open",
      updatedAt: now,
    });
    return NextResponse.json({
      createdAt: now.toISOString(),
      id,
      status: "open",
      takenOverBy: null,
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Support chat conversation create (guest):", err);
    return NextResponse.json(
      { error: "Failed to create conversation." },
      { status: 500 },
    );
  }
}

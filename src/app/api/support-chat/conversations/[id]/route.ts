import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatConversationTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const GUEST_ID_HEADER = "x-support-guest-id";
const GUEST_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/support-chat/conversations/[id]
 * Returns a single conversation (owner only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

  const [conv] = await db
    .select({
      id: supportChatConversationTable.id,
      status: supportChatConversationTable.status,
      takenOverBy: supportChatConversationTable.takenOverBy,
      createdAt: supportChatConversationTable.createdAt,
      updatedAt: supportChatConversationTable.updatedAt,
    })
    .from(supportChatConversationTable)
    .where(eq(supportChatConversationTable.id, conversationId))
    .limit(1);

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const [full] = await db
    .select({
      userId: supportChatConversationTable.userId,
      guestId: supportChatConversationTable.guestId,
    })
    .from(supportChatConversationTable)
    .where(eq(supportChatConversationTable.id, conversationId))
    .limit(1);

  const isOwner =
    (session?.user?.id && full?.userId === session.user.id) ||
    (guestId && GUEST_ID_REGEX.test(guestId) && full?.guestId === guestId);

  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(conv);
}

/**
 * PATCH /api/support-chat/conversations/[id]
 * Close (end) a conversation. Owner only. Sets status to "closed".
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json(
      { error: "Missing conversation id" },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

  const [full] = await db
    .select({
      userId: supportChatConversationTable.userId,
      guestId: supportChatConversationTable.guestId,
      status: supportChatConversationTable.status,
    })
    .from(supportChatConversationTable)
    .where(eq(supportChatConversationTable.id, conversationId))
    .limit(1);

  if (!full) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const isOwner =
    (session?.user?.id && full?.userId === session.user.id) ||
    (guestId && GUEST_ID_REGEX.test(guestId) && full?.guestId === guestId);

  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (full.status === "closed") {
    return NextResponse.json({ status: "closed", id: conversationId });
  }

  try {
    await db
      .update(supportChatConversationTable)
      .set({
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(supportChatConversationTable.id, conversationId));
    return NextResponse.json({
      status: "closed",
      id: conversationId,
    });
  } catch (err) {
    console.error("Support chat conversation close:", err);
    return NextResponse.json(
      { error: "Failed to end conversation." },
      { status: 500 },
    );
  }
}

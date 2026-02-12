import { asc, eq, and } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";
import { checkRateLimit } from "~/lib/rate-limit";
import { generateSupportChatReply } from "~/lib/support-chat-ai";

const GUEST_ID_HEADER = "x-support-guest-id";
const GUEST_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CONTENT_LENGTH = 4_000;

async function getConversationAndCheckAccess(
  request: NextRequest,
  conversationId: string,
) {
  const session = await auth.api.getSession({ headers: request.headers });
  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

  const [conv] = await db
    .select({
      id: supportChatConversationTable.id,
      userId: supportChatConversationTable.userId,
      guestId: supportChatConversationTable.guestId,
      takenOverBy: supportChatConversationTable.takenOverBy,
    })
    .from(supportChatConversationTable)
    .where(eq(supportChatConversationTable.id, conversationId))
    .limit(1);

  if (!conv) return { conv: null, error: 404 as const };

  const isOwner =
    (session?.user?.id && conv.userId === session.user.id) ||
    (guestId && GUEST_ID_REGEX.test(guestId) && conv.guestId === guestId);

  if (!isOwner) return { conv: null, error: 403 as const };
  return { conv, error: null };
}

/**
 * GET /api/support-chat/conversations/[id]/messages
 * Returns messages for the conversation (owner only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const { conv, error } = await getConversationAndCheckAccess(
    request,
    conversationId,
  );
  if (error === 404) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (error === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const messages = await db
      .select({
        id: supportChatMessageTable.id,
        role: supportChatMessageTable.role,
        content: supportChatMessageTable.content,
        createdAt: supportChatMessageTable.createdAt,
      })
      .from(supportChatMessageTable)
      .where(eq(supportChatMessageTable.conversationId, conversationId))
      .orderBy(asc(supportChatMessageTable.createdAt));

    return NextResponse.json({
      messages,
      takenOverBy: conv!.takenOverBy ?? undefined,
    });
  } catch (err) {
    console.error("Support chat messages GET:", err);
    return NextResponse.json(
      { error: "Failed to load messages." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/support-chat/conversations/[id]/messages
 * Send a customer message. If conversation is not taken over, AI replies automatically.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const { conv, error } = await getConversationAndCheckAccess(
    request,
    conversationId,
  );
  if (error === 404) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (error === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = (await request.json()) as { content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content =
    typeof body.content === "string"
      ? body.content.trim().slice(0, MAX_CONTENT_LENGTH)
      : "";
  if (!content) {
    return NextResponse.json(
      { error: "Message content is required." },
      { status: 400 },
    );
  }

  const now = new Date();
  const messageId = crypto.randomUUID();

  try {
    await db.insert(supportChatMessageTable).values({
      id: messageId,
      conversationId,
      role: "customer",
      content,
      createdAt: now,
    });

    await db
      .update(supportChatConversationTable)
      .set({ updatedAt: now })
      .where(eq(supportChatConversationTable.id, conversationId));

    // If not taken over, generate and store AI reply (rate-limited per conversation)
    if (!conv!.takenOverBy) {
      const msgRl = await checkRateLimit(`chat-msg:${conversationId}`, { limit: 10, windowSeconds: 60 });
      if (!msgRl.success) {
        // Don't generate AI reply if rate limited, but still save the user message
        return NextResponse.json({ id: messageId, rateLimited: true });
      }
      const recentRows = await db
        .select({
          role: supportChatMessageTable.role,
          content: supportChatMessageTable.content,
        })
        .from(supportChatMessageTable)
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(asc(supportChatMessageTable.createdAt));

      const session = await auth.api.getSession({ headers: request.headers });
      const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

      const aiReply = await generateSupportChatReply({
        recentMessages: recentRows.map((r) => ({ role: r.role, content: r.content })),
        storeName: process.env.NEXT_PUBLIC_APP_NAME ?? "For the Cult",
        conversationId,
        userId: session?.user?.id ?? guestId ?? undefined,
      });

      const aiMessageId = crypto.randomUUID();
      const aiNow = new Date();
      await db.insert(supportChatMessageTable).values({
        id: aiMessageId,
        conversationId,
        role: "ai",
        content: aiReply,
        createdAt: aiNow,
      });
      await db
        .update(supportChatConversationTable)
        .set({ updatedAt: aiNow })
        .where(eq(supportChatConversationTable.id, conversationId));

      const messages = await db
        .select({
          id: supportChatMessageTable.id,
          role: supportChatMessageTable.role,
          content: supportChatMessageTable.content,
          createdAt: supportChatMessageTable.createdAt,
        })
        .from(supportChatMessageTable)
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(asc(supportChatMessageTable.createdAt));

      return NextResponse.json({
        messages,
        takenOverBy: conv!.takenOverBy ?? undefined,
      });
    }

    const messages = await db
      .select({
        id: supportChatMessageTable.id,
        role: supportChatMessageTable.role,
        content: supportChatMessageTable.content,
        createdAt: supportChatMessageTable.createdAt,
      })
      .from(supportChatMessageTable)
      .where(eq(supportChatMessageTable.conversationId, conversationId))
      .orderBy(asc(supportChatMessageTable.createdAt));

    return NextResponse.json({
      messages,
      takenOverBy: conv!.takenOverBy ?? undefined,
    });
  } catch (err) {
    console.error("Support chat message POST:", err);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 },
    );
  }
}

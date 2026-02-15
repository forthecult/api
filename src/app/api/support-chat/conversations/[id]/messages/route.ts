import { and, asc, eq } from "drizzle-orm";
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
const GUEST_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CONTENT_LENGTH = 4_000;

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
    return NextResponse.json(
      { error: "Missing conversation id" },
      { status: 400 },
    );
  }

  const { conv, error } = await getConversationAndCheckAccess(
    request,
    conversationId,
  );
  if (error === 404) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }
  if (error === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const messages = await db
      .select({
        content: supportChatMessageTable.content,
        createdAt: supportChatMessageTable.createdAt,
        id: supportChatMessageTable.id,
        role: supportChatMessageTable.role,
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
    return NextResponse.json(
      { error: "Missing conversation id" },
      { status: 400 },
    );
  }

  const { conv, error } = await getConversationAndCheckAccess(
    request,
    conversationId,
  );
  if (error === 404) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
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
      content,
      conversationId,
      createdAt: now,
      id: messageId,
      role: "customer",
    });

    await db
      .update(supportChatConversationTable)
      .set({ updatedAt: now })
      .where(eq(supportChatConversationTable.id, conversationId));

    // If not taken over, return immediately with user message; generate AI reply in background.
    // Client sees instant response and typing indicator until poll returns the AI message.
    if (!conv!.takenOverBy) {
      const msgRl = await checkRateLimit(`chat-msg:${conversationId}`, {
        limit: 10,
        windowSeconds: 60,
      });
      if (!msgRl.success) {
        // Don't generate AI reply if rate limited, but still save the user message
        const messagesRateLimited = await db
          .select({
            content: supportChatMessageTable.content,
            createdAt: supportChatMessageTable.createdAt,
            id: supportChatMessageTable.id,
            role: supportChatMessageTable.role,
          })
          .from(supportChatMessageTable)
          .where(eq(supportChatMessageTable.conversationId, conversationId))
          .orderBy(asc(supportChatMessageTable.createdAt));
        return NextResponse.json({
          messages: messagesRateLimited,
          rateLimited: true,
          takenOverBy: conv!.takenOverBy ?? undefined,
        });
      }

      const recentRows = await db
        .select({
          content: supportChatMessageTable.content,
          role: supportChatMessageTable.role,
        })
        .from(supportChatMessageTable)
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(asc(supportChatMessageTable.createdAt));

      const session = await auth.api.getSession({ headers: request.headers });
      const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

      const context = {
        conversationId,
        recentMessages: recentRows.map((r) => ({
          content: r.content,
          role: r.role,
        })),
        storeName: process.env.NEXT_PUBLIC_APP_NAME ?? "For the Cult",
        userId: session?.user?.id ?? guestId ?? undefined,
      };

      // Return immediately with current messages (user message only); AI reply will appear when client polls.
      const messagesNow = await db
        .select({
          content: supportChatMessageTable.content,
          createdAt: supportChatMessageTable.createdAt,
          id: supportChatMessageTable.id,
          role: supportChatMessageTable.role,
        })
        .from(supportChatMessageTable)
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(asc(supportChatMessageTable.createdAt));

      // Generate and store AI reply in background (do not await).
      void generateSupportChatReply(context)
        .then(async (aiReply) => {
          const aiMessageId = crypto.randomUUID();
          const aiNow = new Date();
          await db.insert(supportChatMessageTable).values({
            content: aiReply,
            conversationId,
            createdAt: aiNow,
            id: aiMessageId,
            role: "ai",
          });
          await db
            .update(supportChatConversationTable)
            .set({ updatedAt: aiNow })
            .where(eq(supportChatConversationTable.id, conversationId));
        })
        .catch((err) => {
          console.error("[SupportChat] Background AI reply failed:", err);
        });

      return NextResponse.json({
        messages: messagesNow,
        takenOverBy: conv!.takenOverBy ?? undefined,
      });
    }

    const messages = await db
      .select({
        content: supportChatMessageTable.content,
        createdAt: supportChatMessageTable.createdAt,
        id: supportChatMessageTable.id,
        role: supportChatMessageTable.role,
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

async function getConversationAndCheckAccess(
  request: NextRequest,
  conversationId: string,
) {
  const session = await auth.api.getSession({ headers: request.headers });
  const guestId = request.headers.get(GUEST_ID_HEADER)?.trim();

  const [conv] = await db
    .select({
      guestId: supportChatConversationTable.guestId,
      id: supportChatConversationTable.id,
      takenOverBy: supportChatConversationTable.takenOverBy,
      userId: supportChatConversationTable.userId,
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

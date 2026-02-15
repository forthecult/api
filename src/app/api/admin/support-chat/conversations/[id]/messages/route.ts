import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

const MAX_CONTENT_LENGTH = 8_000;

/**
 * POST /api/admin/support-chat/conversations/[id]/messages
 * Send a message as staff (admin only). Conversation can be taken over or not.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversation id" },
        { status: 400 },
      );
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

    const [conv] = await db
      .select({ id: supportChatConversationTable.id })
      .from(supportChatConversationTable)
      .where(eq(supportChatConversationTable.id, conversationId))
      .limit(1);

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const messageId = crypto.randomUUID();
    const staffUserId =
      authResult.ok && authResult.method === "session"
        ? authResult.user.id
        : null;

    await db.insert(supportChatMessageTable).values({
      content,
      conversationId,
      createdAt: now,
      id: messageId,
      role: "staff",
      userId: staffUserId,
    });

    await db
      .update(supportChatConversationTable)
      .set({ updatedAt: now })
      .where(eq(supportChatConversationTable.id, conversationId));

    const messages = await db
      .select({
        content: supportChatMessageTable.content,
        createdAt: supportChatMessageTable.createdAt,
        id: supportChatMessageTable.id,
        role: supportChatMessageTable.role,
        userId: supportChatMessageTable.userId,
      })
      .from(supportChatMessageTable)
      .where(eq(supportChatMessageTable.conversationId, conversationId))
      .orderBy(asc(supportChatMessageTable.createdAt));

    return NextResponse.json({
      messages,
      success: true,
    });
  } catch (err) {
    console.error("Admin support-chat message POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

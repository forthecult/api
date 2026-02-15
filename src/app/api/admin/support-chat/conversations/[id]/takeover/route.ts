import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportChatConversationTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * POST /api/admin/support-chat/conversations/[id]/takeover
 * Set takenOverBy to current admin. AI will stop replying; staff replies instead.
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

    const adminUserId =
      authResult.method === "session" ? authResult.user.id : null;
    const now = new Date();
    await db
      .update(supportChatConversationTable)
      .set({
        takenOverBy: adminUserId,
        updatedAt: now,
      })
      .where(eq(supportChatConversationTable.id, conversationId));

    return NextResponse.json({
      message: "You have taken over this chat. AI will no longer reply.",
      success: true,
      takenOverBy: adminUserId,
    });
  } catch (err) {
    console.error("Admin support-chat takeover:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

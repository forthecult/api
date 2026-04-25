import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportTicketMessageTable, supportTicketTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { onSupportTicketReply } from "~/lib/create-user-notification";

/**
 * POST /api/admin/support-tickets/[id]/messages
 * Add a staff reply to a support ticket (admin only).
 * Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
    }

    let body: { content?: string };
    try {
      body = (await request.json()) as { content?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    const [ticket] = await db
      .select({ id: supportTicketTable.id, status: supportTicketTable.status })
      .from(supportTicketTable)
      .where(eq(supportTicketTable.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "closed") {
      return NextResponse.json(
        { error: "Cannot add messages to a closed ticket" },
        { status: 400 },
      );
    }

    const messageId = crypto.randomUUID();
    const now = new Date();
    const staffUserId =
      authResult.ok && authResult.method === "session"
        ? authResult.user.id
        : null;

    await db.insert(supportTicketMessageTable).values({
      content,
      createdAt: now,
      id: messageId,
      role: "staff",
      ticketId,
      userId: staffUserId,
    });

    await db
      .update(supportTicketTable)
      .set({ updatedAt: now })
      .where(eq(supportTicketTable.id, ticketId));

    // Notify customer of staff reply (if they have web notifications enabled)
    void onSupportTicketReply(ticketId, { messagePreview: content });

    return NextResponse.json({
      content,
      createdAt: now.toISOString(),
      id: messageId,
      role: "staff",
    });
  } catch (err) {
    console.error("Admin support-tickets [id] messages POST:", err);
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 },
    );
  }
}

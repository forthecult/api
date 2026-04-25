import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportTicketMessageTable, supportTicketTable } from "~/db/schema";
import { auth } from "~/lib/auth";

/**
 * POST /api/support-tickets/[id]/messages
 * Add a follow-up message to a ticket (customer only, own tickets).
 * Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const content =
      typeof body.content === "string"
        ? body.content.trim().slice(0, 10000)
        : "";
    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    const [ticket] = await db
      .select({ id: supportTicketTable.id, status: supportTicketTable.status })
      .from(supportTicketTable)
      .where(
        and(
          eq(supportTicketTable.id, ticketId),
          eq(supportTicketTable.userId, session.user.id),
        ),
      )
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

    await db.insert(supportTicketMessageTable).values({
      content,
      createdAt: now,
      id: messageId,
      role: "customer",
      ticketId,
    });

    await db
      .update(supportTicketTable)
      .set({ updatedAt: now })
      .where(eq(supportTicketTable.id, ticketId));

    return NextResponse.json({
      content,
      createdAt: now.toISOString(),
      id: messageId,
      role: "customer",
    });
  } catch (err) {
    console.error("Support ticket message POST:", err);
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 },
    );
  }
}

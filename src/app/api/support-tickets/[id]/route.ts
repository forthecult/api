import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportTicketMessageTable,
  supportTicketTable,
  userTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";

/**
 * GET /api/support-tickets/[id]
 * Returns a single ticket with messages for the current user (own tickets only).
 * messages[0] is the initial ticket message; rest are follow-ups from support_ticket_message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const [ticket] = await db
    .select({
      id: supportTicketTable.id,
      subject: supportTicketTable.subject,
      message: supportTicketTable.message,
      status: supportTicketTable.status,
      type: supportTicketTable.type,
      createdAt: supportTicketTable.createdAt,
      updatedAt: supportTicketTable.updatedAt,
    })
    .from(supportTicketTable)
    .where(
      and(
        eq(supportTicketTable.id, id),
        eq(supportTicketTable.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const followUps = await db
    .select({
      id: supportTicketMessageTable.id,
      role: supportTicketMessageTable.role,
      content: supportTicketMessageTable.content,
      createdAt: supportTicketMessageTable.createdAt,
      staffFirstName: userTable.firstName,
      staffLastName: userTable.lastName,
      staffImage: userTable.image,
    })
    .from(supportTicketMessageTable)
    .leftJoin(userTable, eq(supportTicketMessageTable.userId, userTable.id))
    .where(eq(supportTicketMessageTable.ticketId, id))
    .orderBy(asc(supportTicketMessageTable.createdAt));

  const messages = [
    {
      id: ticket.id,
      role: "customer" as const,
      content: ticket.message,
      createdAt: ticket.createdAt,
    },
    ...followUps.map((m) => ({
      id: m.id,
      role: m.role as "customer" | "staff",
      content: m.content,
      createdAt: m.createdAt,
      ...(m.role === "staff" &&
      (m.staffFirstName != null ||
        m.staffLastName != null ||
        m.staffImage != null)
        ? {
            staffUser: {
              firstName: m.staffFirstName ?? "",
              lastName: m.staffLastName ?? "",
              image: m.staffImage ?? null,
            },
          }
        : {}),
    })),
  ];

  return NextResponse.json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    type: ticket.type,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages,
  });
}

/**
 * PATCH /api/support-tickets/[id]
 * Update ticket (own tickets only). Customer may only set status to "closed".
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.status !== "closed") {
    return NextResponse.json(
      { error: "Customers may only close a ticket" },
      { status: 400 },
    );
  }

  const [ticket] = await db
    .select({ id: supportTicketTable.id })
    .from(supportTicketTable)
    .where(
      and(
        eq(supportTicketTable.id, id),
        eq(supportTicketTable.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const now = new Date();
  await db
    .update(supportTicketTable)
    .set({ status: "closed", updatedAt: now })
    .where(eq(supportTicketTable.id, id));

  return NextResponse.json({ status: "closed", updatedAt: now.toISOString() });
}

/**
 * DELETE /api/support-tickets/[id]
 * Deletes a ticket for the current user (own tickets only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: _request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const [ticket] = await db
    .select({ id: supportTicketTable.id })
    .from(supportTicketTable)
    .where(
      and(
        eq(supportTicketTable.id, id),
        eq(supportTicketTable.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    await db.delete(supportTicketTable).where(eq(supportTicketTable.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Support ticket DELETE:", err);
    return NextResponse.json(
      { error: "Failed to delete ticket." },
      { status: 500 },
    );
  }
}

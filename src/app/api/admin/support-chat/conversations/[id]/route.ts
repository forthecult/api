import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { ordersTable } from "~/db/schema/orders/tables";
import { userTable } from "~/db/schema/users/tables";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * GET /api/admin/support-chat/conversations/[id]
 * Returns conversation with messages and customer/order context (admin only).
 */
export async function GET(
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
      .select({
        id: supportChatConversationTable.id,
        userId: supportChatConversationTable.userId,
        guestId: supportChatConversationTable.guestId,
        status: supportChatConversationTable.status,
        takenOverBy: supportChatConversationTable.takenOverBy,
        createdAt: supportChatConversationTable.createdAt,
        updatedAt: supportChatConversationTable.updatedAt,
      })
      .from(supportChatConversationTable)
      .where(eq(supportChatConversationTable.id, conversationId))
      .limit(1);

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const [messageRows, customer, orders] = await Promise.all([
      db
        .select({
          id: supportChatMessageTable.id,
          role: supportChatMessageTable.role,
          userId: supportChatMessageTable.userId,
          content: supportChatMessageTable.content,
          createdAt: supportChatMessageTable.createdAt,
          staffFirstName: userTable.firstName,
          staffLastName: userTable.lastName,
          staffImage: userTable.image,
        })
        .from(supportChatMessageTable)
        .leftJoin(userTable, eq(supportChatMessageTable.userId, userTable.id))
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(desc(supportChatMessageTable.createdAt)),
      conv.userId
        ? db
            .select({
              id: userTable.id,
              name: userTable.name,
              email: userTable.email,
            })
            .from(userTable)
            .where(eq(userTable.id, conv.userId))
            .limit(1)
        : Promise.resolve([]),
      conv.userId
        ? db
            .select({
              id: ordersTable.id,
              email: ordersTable.email,
              status: ordersTable.status,
              paymentStatus: ordersTable.paymentStatus,
              totalCents: ordersTable.totalCents,
              createdAt: ordersTable.createdAt,
            })
            .from(ordersTable)
            .where(eq(ordersTable.userId, conv.userId))
            .orderBy(desc(ordersTable.createdAt))
            .limit(10)
        : Promise.resolve([]),
    ]);

    const customerInfo = customer[0]
      ? {
          id: customer[0].id,
          name: customer[0].name ?? "",
          email: customer[0].email ?? "",
        }
      : null;

    const messages = messageRows.reverse().map((m) => ({
      id: m.id,
      role: m.role,
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
    }));

    return NextResponse.json({
      id: conv.id,
      status: conv.status,
      takenOverBy: conv.takenOverBy ?? undefined,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      customer: customerInfo,
      guestId: conv.guestId ?? undefined,
      messages,
      orders: orders.map((o) => ({
        id: o.id,
        email: o.email,
        status: o.status,
        paymentStatus: o.paymentStatus ?? undefined,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin support-chat conversation GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

const ALLOWED_STATUSES = ["open", "closed"] as const;

/**
 * PATCH /api/admin/support-chat/conversations/[id]
 * Update conversation status (admin only). Body: { status: "open" | "closed" }.
 */
export async function PATCH(
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

    let body: { status?: string };
    try {
      body = (await request.json()) as { status?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const status =
      typeof body.status === "string" &&
      ALLOWED_STATUSES.includes(
        body.status as (typeof ALLOWED_STATUSES)[number],
      )
        ? (body.status as (typeof ALLOWED_STATUSES)[number])
        : null;
    if (!status) {
      return NextResponse.json(
        { error: "status must be one of: open, closed" },
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
    await db
      .update(supportChatConversationTable)
      .set({ status, updatedAt: now })
      .where(eq(supportChatConversationTable.id, conversationId));

    return NextResponse.json({ status, updatedAt: now.toISOString() });
  } catch (err) {
    console.error("Admin support-chat conversation PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

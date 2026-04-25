import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportChatConversationTable,
  supportChatMessageTable,
} from "~/db/schema";
import { ordersTable } from "~/db/schema/orders/tables";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversation id" },
        { status: 400 },
      );
    }

    const [conv] = await db
      .select({
        createdAt: supportChatConversationTable.createdAt,
        guestId: supportChatConversationTable.guestId,
        id: supportChatConversationTable.id,
        source: supportChatConversationTable.source,
        status: supportChatConversationTable.status,
        takenOverBy: supportChatConversationTable.takenOverBy,
        updatedAt: supportChatConversationTable.updatedAt,
        userId: supportChatConversationTable.userId,
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
          content: supportChatMessageTable.content,
          createdAt: supportChatMessageTable.createdAt,
          id: supportChatMessageTable.id,
          role: supportChatMessageTable.role,
          staffFirstName: userTable.firstName,
          staffImage: userTable.image,
          staffLastName: userTable.lastName,
          userId: supportChatMessageTable.userId,
        })
        .from(supportChatMessageTable)
        .leftJoin(userTable, eq(supportChatMessageTable.userId, userTable.id))
        .where(eq(supportChatMessageTable.conversationId, conversationId))
        .orderBy(desc(supportChatMessageTable.createdAt)),
      conv.userId
        ? db
            .select({
              email: userTable.email,
              id: userTable.id,
              name: userTable.name,
            })
            .from(userTable)
            .where(eq(userTable.id, conv.userId))
            .limit(1)
        : Promise.resolve([]),
      conv.userId
        ? db
            .select({
              createdAt: ordersTable.createdAt,
              email: ordersTable.email,
              id: ordersTable.id,
              paymentStatus: ordersTable.paymentStatus,
              status: ordersTable.status,
              totalCents: ordersTable.totalCents,
            })
            .from(ordersTable)
            .where(eq(ordersTable.userId, conv.userId))
            .orderBy(desc(ordersTable.createdAt))
            .limit(10)
        : Promise.resolve([]),
    ]);

    const customerInfo = customer[0]
      ? {
          email: customer[0].email ?? "",
          id: customer[0].id,
          name: customer[0].name ?? "",
        }
      : null;

    const messages = messageRows.reverse().map((m) => ({
      content: m.content,
      createdAt: m.createdAt,
      id: m.id,
      role: m.role,
      ...(m.role === "staff" &&
      (m.staffFirstName != null ||
        m.staffLastName != null ||
        m.staffImage != null)
        ? {
            staffUser: {
              firstName: m.staffFirstName ?? "",
              image: m.staffImage ?? null,
              lastName: m.staffLastName ?? "",
            },
          }
        : {}),
    }));

    return NextResponse.json({
      createdAt: conv.createdAt,
      customer: customerInfo,
      guestId: conv.guestId ?? undefined,
      id: conv.id,
      messages,
      orders: orders.map((o) => ({
        createdAt: o.createdAt,
        email: o.email,
        id: o.id,
        paymentStatus: o.paymentStatus ?? undefined,
        status: o.status,
        totalCents: o.totalCents,
      })),
      source: conv.source,
      status: conv.status,
      takenOverBy: conv.takenOverBy ?? undefined,
      updatedAt: conv.updatedAt,
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

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

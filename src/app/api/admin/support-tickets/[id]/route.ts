import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportTicketMessageTable,
  supportTicketTable,
  userTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * GET /api/admin/support-tickets/[id]
 * Returns a single support ticket with customer info and message thread (admin only).
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Missing ticket id" },
        { status: 400 },
      );
    }

    const [row] = await db
      .select({
        id: supportTicketTable.id,
        subject: supportTicketTable.subject,
        message: supportTicketTable.message,
        status: supportTicketTable.status,
        type: supportTicketTable.type,
        createdAt: supportTicketTable.createdAt,
        updatedAt: supportTicketTable.updatedAt,
        userId: supportTicketTable.userId,
        userName: userTable.name,
        userEmail: userTable.email,
      })
      .from(supportTicketTable)
      .innerJoin(userTable, eq(supportTicketTable.userId, userTable.id))
      .where(eq(supportTicketTable.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 },
      );
    }

    const followUps = await db
      .select({
        id: supportTicketMessageTable.id,
        role: supportTicketMessageTable.role,
        userId: supportTicketMessageTable.userId,
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
        id: row.id,
        role: "customer" as const,
        content: row.message,
        createdAt: row.createdAt,
      },
      ...followUps.map((m) => ({
        id: m.id,
        role: m.role as "customer" | "staff",
        content: m.content,
        createdAt: m.createdAt,
        ...(m.role === "staff" && (m.staffFirstName != null || m.staffLastName != null || m.staffImage != null)
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
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      type: row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customer: {
        id: row.userId,
        name: row.userName ?? "",
        email: row.userEmail ?? "",
      },
      messages,
    });
  } catch (err) {
    console.error("Admin support-tickets [id] GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

const ALLOWED_STATUSES = ["open", "pending", "closed"] as const;
const ALLOWED_TYPES = ["normal", "urgent"] as const;

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket status and/or priority/type (admin only).
 * status: open | pending | closed. priority/type: normal | urgent.
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Missing ticket id" },
        { status: 400 },
      );
    }

    let body: { status?: string; type?: string; priority?: string };
    try {
      body = (await request.json()) as {
        status?: string;
        type?: string;
        priority?: string;
      };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const status =
      typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])
        ? (body.status as (typeof ALLOWED_STATUSES)[number])
        : undefined;
    const typeRaw = body.type ?? body.priority;
    const type =
      typeof typeRaw === "string" && ALLOWED_TYPES.includes(typeRaw as (typeof ALLOWED_TYPES)[number])
        ? (typeRaw as (typeof ALLOWED_TYPES)[number])
        : undefined;
    if (!status && type === undefined) {
      return NextResponse.json(
        { error: "Provide status and/or type (priority): status one of open,pending,closed; type one of normal,urgent" },
        { status: 400 },
      );
    }

    const [ticket] = await db
      .select({ id: supportTicketTable.id })
      .from(supportTicketTable)
      .where(eq(supportTicketTable.id, id))
      .limit(1);

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const updates: { status?: (typeof ALLOWED_STATUSES)[number]; type?: (typeof ALLOWED_TYPES)[number]; updatedAt: Date } = {
      updatedAt: now,
    };
    if (status !== undefined) updates.status = status;
    if (type !== undefined) updates.type = type;

    await db
      .update(supportTicketTable)
      .set(updates)
      .where(eq(supportTicketTable.id, id));

    return NextResponse.json({
      ...(status !== undefined && { status }),
      ...(type !== undefined && { type }),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Admin support-tickets [id] PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  supportTicketMessageTable,
  supportTicketTable,
  userTable,
} from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
    }

    const [row] = await db
      .select({
        createdAt: supportTicketTable.createdAt,
        id: supportTicketTable.id,
        message: supportTicketTable.message,
        status: supportTicketTable.status,
        subject: supportTicketTable.subject,
        type: supportTicketTable.type,
        updatedAt: supportTicketTable.updatedAt,
        userEmail: userTable.email,
        userId: supportTicketTable.userId,
        userName: userTable.name,
      })
      .from(supportTicketTable)
      .innerJoin(userTable, eq(supportTicketTable.userId, userTable.id))
      .where(eq(supportTicketTable.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const followUps = await db
      .select({
        content: supportTicketMessageTable.content,
        createdAt: supportTicketMessageTable.createdAt,
        id: supportTicketMessageTable.id,
        role: supportTicketMessageTable.role,
        staffFirstName: userTable.firstName,
        staffImage: userTable.image,
        staffLastName: userTable.lastName,
        userId: supportTicketMessageTable.userId,
      })
      .from(supportTicketMessageTable)
      .leftJoin(userTable, eq(supportTicketMessageTable.userId, userTable.id))
      .where(eq(supportTicketMessageTable.ticketId, id))
      .orderBy(asc(supportTicketMessageTable.createdAt));

    const messages = [
      {
        content: row.message,
        createdAt: row.createdAt,
        id: row.id,
        role: "customer" as const,
      },
      ...followUps.map((m) => ({
        content: m.content,
        createdAt: m.createdAt,
        id: m.id,
        role: m.role as "customer" | "staff",
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
      })),
    ];

    return NextResponse.json({
      createdAt: row.createdAt,
      customer: {
        email: row.userEmail ?? "",
        id: row.userId,
        name: row.userName ?? "",
      },
      id: row.id,
      message: row.message,
      messages,
      status: row.status,
      subject: row.subject,
      type: row.type,
      updatedAt: row.updatedAt,
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
    }

    let body: { priority?: string; status?: string; type?: string };
    try {
      body = (await request.json()) as {
        priority?: string;
        status?: string;
        type?: string;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const status =
      typeof body.status === "string" &&
      ALLOWED_STATUSES.includes(
        body.status as (typeof ALLOWED_STATUSES)[number],
      )
        ? (body.status as (typeof ALLOWED_STATUSES)[number])
        : undefined;
    const typeRaw = body.type ?? body.priority;
    const type =
      typeof typeRaw === "string" &&
      ALLOWED_TYPES.includes(typeRaw as (typeof ALLOWED_TYPES)[number])
        ? (typeRaw as (typeof ALLOWED_TYPES)[number])
        : undefined;
    if (!status && type === undefined) {
      return NextResponse.json(
        {
          error:
            "Provide status and/or type (priority): status one of open,pending,closed; type one of normal,urgent",
        },
        { status: 400 },
      );
    }

    const [ticket] = await db
      .select({ id: supportTicketTable.id })
      .from(supportTicketTable)
      .where(eq(supportTicketTable.id, id))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const now = new Date();
    const updates: {
      status?: (typeof ALLOWED_STATUSES)[number];
      type?: (typeof ALLOWED_TYPES)[number];
      updatedAt: Date;
    } = {
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

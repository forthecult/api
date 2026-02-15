import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { supportTicketTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/support-tickets
 * Returns current user's support tickets (newest first) with pagination.
 * Query params: page (default 1), limit (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
    ),
  );
  const offset = (page - 1) * limit;

  try {
    const [tickets, countResult] = await Promise.all([
      db
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
        .where(eq(supportTicketTable.userId, userId))
        .orderBy(desc(supportTicketTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(supportTicketTable)
        .where(eq(supportTicketTable.userId, userId)),
    ]);

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      tickets,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    console.error("Support tickets GET error:", err);
    const message =
      err instanceof Error &&
      (err.message?.includes("relation") ||
        err.message?.includes("does not exist"))
        ? "Database table missing. Run: bun run db:push"
        : "Failed to load tickets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const TYPE_VALUES = ["normal", "urgent"] as const;

/**
 * POST /api/support-tickets
 * Body: { subject: string, message: string, type?: "normal" | "urgent" }
 * Creates a new support ticket for the current user.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: { subject?: string; message?: string; type?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject =
    typeof body.subject === "string" ? body.subject.trim().slice(0, 500) : "";
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 10000) : "";

  if (!subject) {
    return NextResponse.json(
      { error: "Subject is required." },
      { status: 400 },
    );
  }
  if (!message) {
    return NextResponse.json(
      { error: "Message is required." },
      { status: 400 },
    );
  }

  const type =
    typeof body.type === "string" &&
    TYPE_VALUES.includes(body.type as (typeof TYPE_VALUES)[number])
      ? (body.type as (typeof TYPE_VALUES)[number])
      : "normal";

  // Rate limit only applies when user has an open or pending ticket; if all are closed, allow new ticket
  const ONE_HOUR_MS = 60 * 60 * 1000;
  try {
    const [latestOpenOrPending] = await db
      .select({ createdAt: supportTicketTable.createdAt })
      .from(supportTicketTable)
      .where(
        and(
          eq(supportTicketTable.userId, userId),
          inArray(supportTicketTable.status, ["open", "pending"]),
        ),
      )
      .orderBy(desc(supportTicketTable.createdAt))
      .limit(1);

    if (latestOpenOrPending) {
      const elapsed =
        Date.now() - new Date(latestOpenOrPending.createdAt).getTime();
      if (elapsed < ONE_HOUR_MS) {
        const retryAfterSeconds = Math.ceil((ONE_HOUR_MS - elapsed) / 1000);
        return NextResponse.json(
          {
            error:
              "You can only create one support ticket per hour while you have an open or pending ticket. Update your current ticket if you have new information.",
            retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfterSeconds),
            },
          },
        );
      }
    }
  } catch (err) {
    console.error("Support ticket rate-limit check:", err);
    return NextResponse.json(
      { error: "Failed to check ticket limit." },
      { status: 500 },
    );
  }

  const id = crypto.randomUUID();
  const now = new Date();

  try {
    await db.insert(supportTicketTable).values({
      id,
      userId,
      subject,
      message,
      status: "open",
      type,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error("Support ticket create error:", err);
    const message =
      err instanceof Error &&
      (err.message?.includes("relation") ||
        err.message?.includes("does not exist"))
        ? "Database table missing. Run: bun run db:push"
        : "Failed to create ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    id,
    subject,
    message,
    status: "open",
    type,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    success: "Ticket created.",
  });
}

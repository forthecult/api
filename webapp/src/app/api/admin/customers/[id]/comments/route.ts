import { createId } from "@paralleldrive/cuid2";
import { desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { customerCommentsTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: customerId } = await params;
    const comments = await db
      .select({
        authorId: customerCommentsTable.authorId,
        body: customerCommentsTable.body,
        createdAt: customerCommentsTable.createdAt,
        id: customerCommentsTable.id,
      })
      .from(customerCommentsTable)
      .where(eq(customerCommentsTable.customerId, customerId))
      .orderBy(desc(customerCommentsTable.createdAt));

    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors =
      authorIds.length > 0
        ? await db
            .select({
              email: userTable.email,
              id: userTable.id,
              name: userTable.name,
            })
            .from(userTable)
            .where(inArray(userTable.id, authorIds))
        : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const result = comments.map((c) => ({
      authorId: c.authorId,
      authorName:
        authorMap.get(c.authorId)?.name ??
        authorMap.get(c.authorId)?.email ??
        "—",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      id: c.id,
    }));

    return NextResponse.json({ comments: result });
  } catch (err) {
    console.error("Admin customer comments GET error:", err);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);
    const user = authResult.method === "session" ? authResult.user : null;

    const { id: customerId } = await params;
    const body = (await request.json().catch(() => ({}))) as { body?: unknown };
    const bodyText =
      typeof body.body === "string" && body.body.trim() ? body.body.trim() : "";
    if (!bodyText) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const id = createId();
    await db.insert(customerCommentsTable).values({
      authorId: user!.id,
      body: bodyText,
      createdAt: now,
      customerId,
      id,
    });

    return NextResponse.json({
      authorId: user!.id,
      authorName: user?.email ?? "—",
      body: bodyText,
      createdAt: now.toISOString(),
      id,
    });
  } catch (err) {
    console.error("Admin customer comments POST error:", err);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}

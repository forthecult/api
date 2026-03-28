import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import { db } from "~/db";
import { aiMemoryTable } from "~/db/schema/ai-chat/tables";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  let body: { category?: null | string; content?: string };
  try {
    body = (await request.json()) as {
      category?: null | string;
      content?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const existing = await db
    .select()
    .from(aiMemoryTable)
    .where(
      and(eq(aiMemoryTable.id, id), eq(aiMemoryTable.userId, session.user.id)),
    )
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .update(aiMemoryTable)
    .set({
      category:
        body.category === undefined ? existing[0].category : body.category,
      content:
        typeof body.content === "string" ? body.content : existing[0].content,
      updatedAt: new Date(),
    })
    .where(eq(aiMemoryTable.id, id));
  const row = await db
    .select()
    .from(aiMemoryTable)
    .where(eq(aiMemoryTable.id, id))
    .limit(1);
  return NextResponse.json({ memory: row[0] });
}

export async function DELETE(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await db
    .delete(aiMemoryTable)
    .where(
      and(eq(aiMemoryTable.id, id), eq(aiMemoryTable.userId, session.user.id)),
    )
    .returning({ id: aiMemoryTable.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiChatConversationTable } from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await db
    .delete(aiChatConversationTable)
    .where(
      and(
        eq(aiChatConversationTable.id, id),
        eq(aiChatConversationTable.userId, session.user.id),
      ),
    )
    .returning({ id: aiChatConversationTable.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const row = await db
    .select()
    .from(aiChatConversationTable)
    .where(
      and(
        eq(aiChatConversationTable.id, id),
        eq(aiChatConversationTable.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!row[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation: row[0] });
}

export async function PUT(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  let body: {
    characterSlug?: null | string;
    messages?: unknown[];
    title?: null | string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const existing = await db
    .select()
    .from(aiChatConversationTable)
    .where(
      and(
        eq(aiChatConversationTable.id, id),
        eq(aiChatConversationTable.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .update(aiChatConversationTable)
    .set({
      characterSlug:
        body.characterSlug === undefined
          ? existing[0].characterSlug
          : body.characterSlug,
      messages:
        body.messages === undefined ? existing[0].messages : body.messages,
      title: body.title === undefined ? existing[0].title : body.title,
      updatedAt: new Date(),
    })
    .where(eq(aiChatConversationTable.id, id));
  const row = await db
    .select()
    .from(aiChatConversationTable)
    .where(eq(aiChatConversationTable.id, id))
    .limit(1);
  return NextResponse.json({ conversation: row[0] });
}

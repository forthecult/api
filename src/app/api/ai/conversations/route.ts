import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiChatConversationTable } from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";

/** List persisted conversations for the signed-in user. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select({
      characterSlug: aiChatConversationTable.characterSlug,
      createdAt: aiChatConversationTable.createdAt,
      id: aiChatConversationTable.id,
      title: aiChatConversationTable.title,
      updatedAt: aiChatConversationTable.updatedAt,
    })
    .from(aiChatConversationTable)
    .where(eq(aiChatConversationTable.userId, session.user.id))
    .orderBy(desc(aiChatConversationTable.updatedAt));
  return NextResponse.json({ conversations: rows });
}

/** Create a conversation row (id may be client session id). */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    characterSlug?: null | string;
    id?: string;
    messages?: unknown[];
    title?: null | string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim() || createId();
  const now = new Date();
  await db.insert(aiChatConversationTable).values({
    characterSlug: body.characterSlug?.trim() || null,
    createdAt: now,
    id,
    messages: Array.isArray(body.messages) ? body.messages : [],
    title: body.title?.trim() || null,
    updatedAt: now,
    userId: session.user.id,
  });
  const row = await db
    .select()
    .from(aiChatConversationTable)
    .where(eq(aiChatConversationTable.id, id))
    .limit(1);
  return NextResponse.json({ conversation: row[0] });
}

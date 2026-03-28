import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { createId } from "@paralleldrive/cuid2";

import { auth } from "~/lib/auth";
import { db } from "~/db";
import { aiMemoryTable } from "~/db/schema/ai-chat/tables";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(aiMemoryTable)
    .where(eq(aiMemoryTable.userId, session.user.id))
    .orderBy(desc(aiMemoryTable.createdAt));
  return NextResponse.json({ memories: rows });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { category?: string; content?: string };
  try {
    body = (await request.json()) as { category?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const id = createId();
  const now = new Date();
  await db.insert(aiMemoryTable).values({
    category: body.category?.trim() || null,
    content: body.content.trim(),
    createdAt: now,
    id,
    updatedAt: now,
    userId: session.user.id,
  });
  const row = await db
    .select()
    .from(aiMemoryTable)
    .where(eq(aiMemoryTable.id, id))
    .limit(1);
  return NextResponse.json({ memory: row[0] });
}

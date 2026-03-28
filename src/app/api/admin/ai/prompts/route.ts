import { asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { createId } from "@paralleldrive/cuid2";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { db } from "~/db";
import { aiAdminPromptTable } from "~/db/schema/ai-chat/tables";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  const rows = await db
    .select()
    .from(aiAdminPromptTable)
    .orderBy(asc(aiAdminPromptTable.sortOrder));
  return NextResponse.json({ prompts: rows });
}

export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  let body: {
    content?: string;
    enabled?: boolean;
    key?: string;
    sortOrder?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.key?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "key and content required" },
      { status: 400 },
    );
  }
  const id = createId();
  const now = new Date();
  await db.insert(aiAdminPromptTable).values({
    content: body.content.trim(),
    enabled: body.enabled ?? true,
    id,
    key: body.key.trim(),
    sortOrder: body.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  const row = await db
    .select()
    .from(aiAdminPromptTable)
    .where(eq(aiAdminPromptTable.id, id))
    .limit(1);
  return NextResponse.json({ prompt: row[0] });
}

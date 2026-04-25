import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { aiRagChunkTable } from "~/db/schema/ai-chat/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { embedTextVenice } from "~/lib/ai/embeddings";
import { getServerVeniceApiKey } from "~/lib/ai/venice";

/**
 * Admin: ingest a global RAG chunk (embedding stored server-side).
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  const key = getServerVeniceApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "VENICE_API_KEY is not configured" },
      { status: 503 },
    );
  }
  let body: { content?: string; sourceLabel?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const id = createId();
  const embedding = await embedTextVenice(key, body.content.trim());
  await db.insert(aiRagChunkTable).values({
    content: body.content.trim(),
    createdAt: new Date(),
    embedding,
    id,
    scope: "global",
    sourceLabel: body.sourceLabel?.trim() || null,
    userId: null,
  });
  return NextResponse.json({ id, ok: true });
}

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiRagChunkTable } from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";

/** List the signed-in user's RAG chunks (text previews; embeddings omitted). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "80", 10) || 80),
  );

  const rows = await db
    .select({
      content: aiRagChunkTable.content,
      createdAt: aiRagChunkTable.createdAt,
      id: aiRagChunkTable.id,
      sourceLabel: aiRagChunkTable.sourceLabel,
    })
    .from(aiRagChunkTable)
    .where(
      and(
        eq(aiRagChunkTable.scope, "user"),
        eq(aiRagChunkTable.userId, session.user.id),
      ),
    )
    .orderBy(desc(aiRagChunkTable.createdAt))
    .limit(limit);

  const chunks = rows.map((r) => ({
    contentPreview:
      r.content.length > 240 ? `${r.content.slice(0, 240)}…` : r.content,
    createdAt: r.createdAt,
    id: r.id,
    sourceLabel: r.sourceLabel,
  }));

  return NextResponse.json({ chunks });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiRagChunkTable } from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/** Delete a single user-scoped RAG chunk owned by the signed-in user. */
export async function DELETE(request: Request, context: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await db
    .delete(aiRagChunkTable)
    .where(
      and(
        eq(aiRagChunkTable.id, id),
        eq(aiRagChunkTable.userId, session.user.id),
        eq(aiRagChunkTable.scope, "user"),
      ),
    )
    .returning({ id: aiRagChunkTable.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

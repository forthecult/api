import { createId } from "@paralleldrive/cuid2";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiRagChunkTable } from "~/db/schema/ai-chat/tables";
import { chunkTextForRag } from "~/lib/ai/chunk-text";
import { embedTextVenice } from "~/lib/ai/embeddings";
import { getServerVeniceApiKey } from "~/lib/ai/venice";
import { auth } from "~/lib/auth";

const MAX_CHUNKS = 64;

/**
 * Per-user RAG: upload text (JSON or multipart file). Chunks are embedded with Venice and stored under scope "user".
 * Vision / images: use /chat image attachments — models receive image parts there; this route is text-only.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = getServerVeniceApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "AI service is not configured" },
      { status: 503 },
    );
  }

  let text = "";
  let sourceLabel: null | string = null;

  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const label = form.get("sourceLabel");
    if (typeof label === "string" && label.trim()) sourceLabel = label.trim();
    if (file instanceof File) {
      if (file.type.startsWith("image/")) {
        return NextResponse.json(
          {
            error:
              "Image uploads for vision belong in /chat (attach to a message). This endpoint ingests text for RAG only.",
          },
          { status: 400 },
        );
      }
      text = await file.text();
    } else {
      const t = form.get("text");
      if (typeof t === "string") text = t;
    }
  } else {
    let body: { sourceLabel?: string; text?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body.text === "string") text = body.text;
    if (typeof body.sourceLabel === "string" && body.sourceLabel.trim()) {
      sourceLabel = body.sourceLabel.trim();
    }
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "text or file with text content required" },
      { status: 400 },
    );
  }

  const parts = chunkTextForRag(trimmed);
  if (parts.length > MAX_CHUNKS) {
    return NextResponse.json(
      { error: `Too many chunks (${parts.length}). Max ${MAX_CHUNKS}.` },
      { status: 400 },
    );
  }

  const inserted: string[] = [];
  for (const chunk of parts) {
    const id = createId();
    const embedding = await embedTextVenice(key, chunk);
    await db.insert(aiRagChunkTable).values({
      content: chunk,
      createdAt: new Date(),
      embedding,
      id,
      scope: "user",
      sourceLabel,
      userId: session.user.id,
    });
    inserted.push(id);
  }

  return NextResponse.json({ chunkIds: inserted, chunks: inserted.length, ok: true });
}

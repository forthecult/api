import { and, eq, isNull } from "drizzle-orm";

import { db } from "~/db";
import { aiRagChunkTable } from "~/db/schema/ai-chat/tables";

import { embedTextVenice } from "./embeddings";

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveRagContextLines(options: {
  apiKey: string;
  limit?: number;
  queryText: string;
  userId: null | string;
  userRagEnabled: boolean;
}): Promise<string[]> {
  const limit = options.limit ?? 5;
  const queryEmbedding = await embedTextVenice(
    options.apiKey,
    options.queryText,
  );

  const globalRows = await db
    .select({
      content: aiRagChunkTable.content,
      embedding: aiRagChunkTable.embedding,
    })
    .from(aiRagChunkTable)
    .where(
      and(eq(aiRagChunkTable.scope, "global"), isNull(aiRagChunkTable.userId)),
    );

  let userRows: { content: string; embedding: number[] | null }[] = [];
  if (options.userRagEnabled && options.userId) {
    userRows = await db
      .select({
        content: aiRagChunkTable.content,
        embedding: aiRagChunkTable.embedding,
      })
      .from(aiRagChunkTable)
      .where(
        and(
          eq(aiRagChunkTable.scope, "user"),
          eq(aiRagChunkTable.userId, options.userId),
        ),
      );
  }

  const scored: { content: string; score: number }[] = [];
  for (const row of [...globalRows, ...userRows]) {
    const emb = row.embedding;
    if (!emb?.length) continue;
    scored.push({
      content: row.content,
      score: cosineSimilarity(queryEmbedding, emb),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (seen.has(s.content)) continue;
    seen.add(s.content);
    out.push(s.content);
    if (out.length >= limit) break;
  }
  return out;
}

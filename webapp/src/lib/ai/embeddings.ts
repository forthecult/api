/**
 * Venice OpenAI-compatible embeddings. Used for RAG retrieval.
 */

const VENICE_BASE = "https://api.venice.ai/api/v1";

export async function embedTextVenice(
  apiKey: string,
  input: string,
): Promise<number[]> {
  const model =
    process.env.VENICE_EMBEDDING_MODEL?.trim() || "text-embedding-bge-m3";
  const res = await fetch(`${VENICE_BASE}/embeddings`, {
    body: JSON.stringify({ input, model }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `Venice embeddings failed: ${res.status} ${t.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as {
    data?: { embedding?: number[] }[];
  };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("Venice embeddings: empty embedding");
  return emb;
}

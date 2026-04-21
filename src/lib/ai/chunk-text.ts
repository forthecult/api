/** Split long text into RAG-sized chunks (roughly character-based). */
const DEFAULT_MAX = 1800;

export function chunkTextForRag(
  text: string,
  maxChars = DEFAULT_MAX,
): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    chunks.push(t.slice(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

import type { UIMessage } from "ai";

export function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    const parts = m.parts;
    if (parts?.length) {
      const texts: string[] = [];
      for (const p of parts) {
        if (p.type === "text" && "text" in p) {
          const t = (p as { text?: string }).text;
          if (typeof t === "string" && t.trim()) texts.push(t);
        }
      }
      if (texts.length) return texts.join("\n");
    }
  }
  return "";
}

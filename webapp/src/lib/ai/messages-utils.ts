import type { UIMessage } from "ai";

/** True if any user message includes an image file part (for vision model routing). */
export function messagesHaveUserImage(messages: UIMessage[]): boolean {
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const p of m.parts ?? []) {
      if (p.type !== "file") continue;
      const mediaType =
        "mediaType" in p && typeof p.mediaType === "string" ? p.mediaType : "";
      if (mediaType.startsWith("image/")) return true;
    }
  }
  return false;
}

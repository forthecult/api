import { asc, eq } from "drizzle-orm";

import { db } from "~/db";
import { aiAdminPromptTable, aiMemoryTable } from "~/db/schema/ai-chat/tables";

import { retrieveRagContextLines } from "./rag-retrieval";

const BRAND_SNIPPET =
  "You are the in-store AI assistant for For the Cult, a lifestyle and curated commerce brand. Be helpful, concise, and respectful. Do not invent order numbers or personal data.";

export async function buildAgentSystemPrompt(options: {
  lastUserText: string;
  userId: null | string;
  userPrompt: null | string;
  userRagEnabled: boolean;
  veniceApiKey: string;
}): Promise<string> {
  const adminRows = await db
    .select({
      content: aiAdminPromptTable.content,
      key: aiAdminPromptTable.key,
    })
    .from(aiAdminPromptTable)
    .where(eq(aiAdminPromptTable.enabled, true))
    .orderBy(asc(aiAdminPromptTable.sortOrder));

  const parts: string[] = [];
  for (const r of adminRows) {
    parts.push(`[${r.key}]\n${r.content}`);
  }
  parts.push(`[brand]\n${BRAND_SNIPPET}`);

  if (options.lastUserText.trim()) {
    try {
      const rag = await retrieveRagContextLines({
        apiKey: options.veniceApiKey,
        queryText: options.lastUserText,
        userId: options.userId,
        userRagEnabled: options.userRagEnabled,
      });
      if (rag.length) {
        parts.push(
          `[context]\n${rag.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
        );
      }
    } catch {
      // if embeddings fail, continue without RAG context
    }
  }

  if (options.userPrompt?.trim()) {
    parts.push(`[user instructions]\n${options.userPrompt.trim()}`);
  }

  if (options.userId) {
    const mems = await db
      .select({ content: aiMemoryTable.content })
      .from(aiMemoryTable)
      .where(eq(aiMemoryTable.userId, options.userId));
    if (mems.length) {
      parts.push(
        `[saved memories]\n${mems.map((m) => `- ${m.content}`).join("\n")}`,
      );
    }
  }

  return parts.join("\n\n");
}

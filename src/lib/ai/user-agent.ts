import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { aiAgentTable } from "~/db/schema/ai-chat/tables";

export async function getOrCreateAiAgent(userId: string) {
  const existing = await db
    .select()
    .from(aiAgentTable)
    .where(eq(aiAgentTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const id = createId();
  const now = new Date();
  await db.insert(aiAgentTable).values({
    backupMode: "none",
    createdAt: now,
    id,
    localCacheEncrypted: false,
    updatedAt: now,
    userId,
    userRagEnabled: true,
  });
  const row = await db
    .select()
    .from(aiAgentTable)
    .where(eq(aiAgentTable.userId, userId))
    .limit(1);
  return row[0]!;
}

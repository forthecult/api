import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { db } from "~/db";
import {
  aiCharacterQuotaTable,
  aiGuestUsageTable,
} from "~/db/schema/ai-chat/tables";
import { getMemberTierForUser } from "~/lib/get-member-tier";

export async function checkGuestQuota(
  characterSlug: string,
  identifier: string,
): Promise<{ allowed: boolean; max: number; used: number }> {
  const max = await getMaxFreeMessagesForCharacter(characterSlug);
  const existing = await db
    .select()
    .from(aiGuestUsageTable)
    .where(
      and(
        eq(aiGuestUsageTable.identifier, identifier),
        eq(aiGuestUsageTable.characterSlug, characterSlug),
      ),
    )
    .limit(1);
  const used = existing[0]?.messagesUsed ?? 0;
  return { allowed: used < max, max, used };
}

export async function getMaxFreeMessagesForCharacter(
  characterSlug: string,
): Promise<number> {
  const row = await db
    .select()
    .from(aiCharacterQuotaTable)
    .where(eq(aiCharacterQuotaTable.characterSlug, characterSlug))
    .limit(1);
  if (row[0]?.enabled === false) return 1;
  return row[0]?.maxFreeMessagesNonMember ?? 1;
}

export function hashGuestToken(guestId: string): string {
  return createHash("sha256").update(`ai-guest:${guestId}`).digest("hex");
}

export async function incrementGuestUsage(
  characterSlug: string,
  identifier: string,
): Promise<void> {
  const now = new Date();
  const existing = await db
    .select()
    .from(aiGuestUsageTable)
    .where(
      and(
        eq(aiGuestUsageTable.identifier, identifier),
        eq(aiGuestUsageTable.characterSlug, characterSlug),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(aiGuestUsageTable).values({
      characterSlug,
      identifier,
      messagesUsed: 1,
      updatedAt: now,
    });
    return;
  }
  await db
    .update(aiGuestUsageTable)
    .set({
      messagesUsed: existing[0]!.messagesUsed + 1,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiGuestUsageTable.identifier, identifier),
        eq(aiGuestUsageTable.characterSlug, characterSlug),
      ),
    );
}

export async function isMember(userId: null | string): Promise<boolean> {
  if (!userId) return false;
  const tier = await getMemberTierForUser(userId);
  return tier != null;
}

export function resolveGuestIdentifier(options: {
  guestId: null | string;
  userId: null | string;
}): string {
  if (options.userId) return `u:${options.userId}`;
  if (options.guestId?.trim())
    return `g:${hashGuestToken(options.guestId.trim())}`;
  return `anon:${hashGuestToken("unknown")}`;
}

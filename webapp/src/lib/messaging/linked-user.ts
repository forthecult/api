import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import {
  aiMessagingChannelTable,
  aiMessagingUserLinkTable,
} from "~/db/schema/ai-chat/tables";

export async function getLinkedFtcUserId(options: {
  externalUserId: string;
  messagingChannelId: string;
  provider: "discord" | "slack";
}): Promise<null | string> {
  const rows = await db
    .select({ userId: aiMessagingUserLinkTable.userId })
    .from(aiMessagingUserLinkTable)
    .where(
      and(
        eq(
          aiMessagingUserLinkTable.messagingChannelId,
          options.messagingChannelId,
        ),
        eq(aiMessagingUserLinkTable.provider, options.provider),
        eq(aiMessagingUserLinkTable.externalUserId, options.externalUserId),
      ),
    )
    .limit(1);
  return rows[0]?.userId ?? null;
}

/** Match `link <code>`, `culture link <code>`, or legacy `ftc link <code>` (hex code from dashboard). */
export function parseLinkCodeFromMessage(text: string): null | string {
  const t = text.trim();
  const m = t.match(/^(?:(?:culture|ftc)\s+link|link)\s+([a-f0-9]{6,64})$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export async function tryCompleteLinkByCode(options: {
  code: string;
  externalTeamId: null | string;
  externalUserId: string;
  messagingChannelId: string;
  provider: "discord" | "slack";
}): Promise<{ error: string; ok: false } | { ftcUserId: string; ok: true }> {
  const code = options.code.trim().toLowerCase();
  if (!code) return { error: "empty", ok: false };

  const col =
    options.provider === "slack"
      ? aiMessagingChannelTable.slackLinkCode
      : aiMessagingChannelTable.discordLinkCode;

  const rows = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(eq(col, code))
    .limit(1);
  const match = rows[0];
  if (!match) return { error: "invalid_code", ok: false };

  const ftcUserId = match.userId;

  await db
    .insert(aiMessagingUserLinkTable)
    .values({
      externalTeamId: options.externalTeamId,
      externalUserId: options.externalUserId,
      id: createId(),
      messagingChannelId: options.messagingChannelId,
      provider: options.provider,
      userId: ftcUserId,
    })
    .onConflictDoUpdate({
      set: { userId: ftcUserId },
      target: [
        aiMessagingUserLinkTable.messagingChannelId,
        aiMessagingUserLinkTable.provider,
        aiMessagingUserLinkTable.externalUserId,
      ],
    });

  await db
    .update(aiMessagingChannelTable)
    .set({
      ...(options.provider === "slack"
        ? { slackLinkCode: null }
        : { discordLinkCode: null }),
      updatedAt: new Date(),
    })
    .where(eq(aiMessagingChannelTable.id, match.id));

  return { ftcUserId, ok: true };
}

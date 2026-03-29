import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiMessagingChannelTable } from "~/db/schema/ai-chat/tables";
import {
  getLinkedFtcUserId,
  parseFtcLinkCodeFromMessage,
  tryCompleteLinkByCode,
} from "~/lib/messaging/linked-user";
import {
  generateMessagingAgentReply,
  messagingConversationId,
} from "~/lib/messaging/messaging-reply";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.MESSAGING_INTERNAL_SECRET?.trim();
  const auth = request.headers.get("authorization")?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    authorId: string;
    channelId: string;
    content: string;
    discordChannelId: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const authorId = body.authorId?.trim();
  const discordChannelId = body.discordChannelId?.trim();
  const content = body.content ?? "";
  if (!channelId || !authorId || !discordChannelId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(
      and(
        eq(aiMessagingChannelTable.id, channelId),
        eq(aiMessagingChannelTable.provider, "discord"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.discordBotToken?.trim()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const token = row.discordBotToken.trim();

  const linkCode = parseFtcLinkCodeFromMessage(content);
  if (linkCode) {
    const res = await tryCompleteLinkByCode({
      code: linkCode,
      externalTeamId: null,
      externalUserId: authorId,
      messagingChannelId: channelId,
      provider: "discord",
    });
    const msg = res.ok
      ? "Your Discord is linked to your For the Cult account. Send another message to chat with the assistant."
      : "Invalid or expired link code. Copy a fresh code from Dashboard → AI → Channels.";
    await discordCreateMessage(token, discordChannelId, msg);
    return NextResponse.json({ ok: true });
  }

  const ftcUserId = await getLinkedFtcUserId({
    externalUserId: authorId,
    messagingChannelId: channelId,
    provider: "discord",
  });
  const resolvedUserId = ftcUserId ?? row.userId;

  const threadKey = `dc-dm-${authorId}`;
  const convoId = messagingConversationId(channelId, threadKey);

  const result = await generateMessagingAgentReply({
    conversationId: convoId,
    userId: resolvedUserId,
    userText: content.trim(),
  });

  if (!result.ok) {
    const err =
      result.error === "quota"
        ? "Free message limit reached. Upgrade to continue."
        : result.error === "no_ai"
          ? "AI is not configured."
          : "Something went wrong.";
    await discordCreateMessage(token, discordChannelId, err);
    return NextResponse.json({ ok: true });
  }

  await discordCreateMessage(token, discordChannelId, result.text);
  return NextResponse.json({ ok: true });
}

async function discordCreateMessage(
  botToken: string,
  discordChannelId: string,
  content: string,
): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(discordChannelId)}/messages`,
    {
      body: JSON.stringify({
        content: content.slice(0, 2000),
      }),
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
}

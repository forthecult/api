import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { aiMessagingChannelTable } from "~/db/schema/ai-chat/tables";
import {
  generateMessagingAgentReply,
  messagingConversationId,
} from "~/lib/messaging/messaging-reply";

export const maxDuration = 60;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { is_bot?: boolean };
    text?: string;
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;
  const secret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(
      and(
        eq(aiMessagingChannelTable.id, channelId),
        eq(aiMessagingChannelTable.provider, "telegram"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.telegramBotToken?.trim() || row.telegramWebhookSecret !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = update.message;
  if (!msg || msg.from?.is_bot) {
    return NextResponse.json({ ok: true });
  }

  const chatIdStr = String(msg.chat.id);
  const token = row.telegramBotToken.trim();

  const text = msg.text?.trim() ?? "";
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const code = parts[1]?.trim();
    if (code && row.telegramLinkCode && code === row.telegramLinkCode) {
      await db
        .update(aiMessagingChannelTable)
        .set({
          linkedAt: new Date(),
          telegramChatId: chatIdStr,
          telegramLinkCode: null,
          updatedAt: new Date(),
        })
        .where(eq(aiMessagingChannelTable.id, channelId));
      await sendTelegramMessage(
        token,
        chatIdStr,
        "Linked to your For the Cult account. Send a message to chat with your assistant.",
      );
    } else if (!code) {
      await sendTelegramMessage(
        token,
        chatIdStr,
        "Open Dashboard → AI → Channels, save your bot token, then open the t.me link with the link code to connect.",
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (!row.telegramChatId || row.telegramChatId !== chatIdStr) {
    await sendTelegramMessage(
      token,
      chatIdStr,
      "This bot is not linked to your account. In the site dashboard under AI → Channels, use the Telegram link with your one-time code.",
    );
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const convoId = messagingConversationId(channelId, `tg-${chatIdStr}`);
  const result = await generateMessagingAgentReply({
    conversationId: convoId,
    userId: row.userId,
    userText: text,
  });

  if (!result.ok) {
    const err =
      result.error === "quota"
        ? "You've reached the free message limit. Upgrade to continue."
        : result.error === "no_ai"
          ? "AI is not configured on the server."
          : "Something went wrong. Try again later.";
    await sendTelegramMessage(token, chatIdStr, err);
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage(token, chatIdStr, result.text);
  return NextResponse.json({ ok: true });
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
) {
  await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
    {
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

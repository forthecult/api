import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "~/db";
import {
  aiMessagingChannelTable,
  slackEventProcessedTable,
} from "~/db/schema/ai-chat/tables";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await context.params;

  const rows = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(
      and(
        eq(aiMessagingChannelTable.id, channelId),
        eq(aiMessagingChannelTable.provider, "slack"),
      ),
    )
    .limit(1);
  const row = rows[0];
  const signingSecret = row?.slackSigningSecret?.trim();
  const botToken = row?.slackBotToken?.trim();
  if (!row || !signingSecret || !botToken) {
    return NextResponse.json({ error: "not_configured" }, { status: 401 });
  }

  const timestamp = request.headers.get("x-slack-request-timestamp")?.trim();
  const slackSig = request.headers.get("x-slack-signature")?.trim();
  if (!timestamp || !slackSig) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  const rawBody = await request.text();

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) {
    return NextResponse.json({ error: "stale" }, { status: 401 });
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hmac}`;
  if (!timingSafeEqualStrings(expected, slackSig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: {
    challenge?: string;
    event?: {
      bot_id?: string;
      channel?: string;
      subtype?: string;
      text?: string;
      type?: string;
      user?: string;
    };
    event_id?: string;
    team_id?: string;
    type?: string;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.type === "url_verification" && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback" || !body.event) {
    return NextResponse.json({ ok: true });
  }

  const eventId = body.event_id?.trim();
  if (eventId) {
    const inserted = await db
      .insert(slackEventProcessedTable)
      .values({ eventId })
      .onConflictDoNothing()
      .returning({ eventId: slackEventProcessedTable.eventId });
    if (inserted.length === 0) {
      return NextResponse.json({ ok: true });
    }
  }

  if (body.team_id && row.slackTeamId && body.team_id !== row.slackTeamId) {
    return NextResponse.json({ ok: true });
  }

  const ev = body.event;
  if (ev.type !== "message") {
    return NextResponse.json({ ok: true });
  }
  if (ev.bot_id || ev.subtype === "bot_message") {
    return NextResponse.json({ ok: true });
  }

  const rawText = ev.text?.trim() ?? "";
  if (!rawText) {
    return NextResponse.json({ ok: true });
  }

  const text = stripLeadingBotMention(rawText);
  if (!text) {
    return NextResponse.json({ ok: true });
  }

  if (body.team_id && !row.slackTeamId) {
    await db
      .update(aiMessagingChannelTable)
      .set({
        slackTeamId: body.team_id,
        updatedAt: new Date(),
      })
      .where(eq(aiMessagingChannelTable.id, channelId));
  }

  const slackUserId = ev.user?.trim() ?? "";
  if (!slackUserId) {
    return NextResponse.json({ ok: true });
  }

  const channel = ev.channel ?? "unknown";

  const linkCode = parseFtcLinkCodeFromMessage(text);
  if (linkCode) {
    const res = await tryCompleteLinkByCode({
      code: linkCode,
      externalTeamId: body.team_id ?? null,
      externalUserId: slackUserId,
      messagingChannelId: channelId,
      provider: "slack",
    });
    const reply = res.ok
      ? "Your Slack account is linked to your For the Cult profile. Send another message to chat with the assistant."
      : "Invalid or expired link code. Open Dashboard → AI → Channels and copy a fresh code.";
    await fetch("https://slack.com/api/chat.postMessage", {
      body: JSON.stringify({
        channel,
        text: reply.slice(0, 4000),
      }),
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "POST",
    });
    return NextResponse.json({ ok: true });
  }

  const ftcUserId = await getLinkedFtcUserId({
    externalUserId: slackUserId,
    messagingChannelId: channelId,
    provider: "slack",
  });
  if (!ftcUserId) {
    await fetch("https://slack.com/api/chat.postMessage", {
      body: JSON.stringify({
        channel,
        text: [
          "Link your For the Cult account first:",
          "1) Open the site → Dashboard → AI → Channels.",
          "2) Copy your Slack link code.",
          `3) Message this app: \`ftc link YOURCODE\` (or \`link YOURCODE\`).`,
        ].join("\n"),
      }),
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "POST",
    });
    return NextResponse.json({ ok: true });
  }

  const threadKey = `sl-${channel}`;
  const convoId = messagingConversationId(channelId, threadKey);

  const result = await generateMessagingAgentReply({
    conversationId: convoId,
    userId: ftcUserId,
    userText: text,
  });

  if (!result.ok) {
    const err =
      result.error === "quota"
        ? "Free message limit reached. Upgrade to continue."
        : result.error === "no_ai"
          ? "AI is not configured."
          : "Something went wrong.";
    await fetch("https://slack.com/api/chat.postMessage", {
      body: JSON.stringify({
        channel,
        text: err.slice(0, 4000),
      }),
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "POST",
    });
    return NextResponse.json({ ok: true });
  }

  await fetch("https://slack.com/api/chat.postMessage", {
    body: JSON.stringify({
      channel,
      text: result.text.slice(0, 4000),
    }),
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    method: "POST",
  });

  return NextResponse.json({ ok: true });
}

function stripLeadingBotMention(text: string): string {
  return text.replace(/^<@[^>]+>\s*/u, "").trim();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

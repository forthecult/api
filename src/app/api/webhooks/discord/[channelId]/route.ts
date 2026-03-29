import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import nacl from "tweetnacl";

import { db } from "~/db";
import { aiMessagingChannelTable } from "~/db/schema/ai-chat/tables";
import { getLinkedFtcUserId } from "~/lib/messaging/linked-user";
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
        eq(aiMessagingChannelTable.provider, "discord"),
      ),
    )
    .limit(1);
  const row = rows[0];
  const publicKeyHex = row?.discordPublicKey?.trim();
  if (!row?.discordBotToken?.trim() || !publicKeyHex) {
    return jsonResponse({ error: "not_configured" }, 401);
  }

  const signature = request.headers.get("x-signature-ed25519")?.trim();
  const timestamp = request.headers.get("x-signature-timestamp")?.trim();
  if (!signature || !timestamp) {
    return jsonResponse({ error: "bad_signature" }, 401);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  const msg = new Uint8Array(timestamp.length + rawBody.length);
  msg.set(Buffer.from(timestamp, "utf8"), 0);
  msg.set(rawBody, timestamp.length);

  let publicKey: Uint8Array;
  try {
    publicKey = Buffer.from(publicKeyHex, "hex");
  } catch {
    return jsonResponse({ error: "bad_public_key" }, 401);
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = Buffer.from(signature, "hex");
  } catch {
    return jsonResponse({ error: "bad_signature" }, 401);
  }

  const ok = nacl.sign.detached.verify(msg, sigBytes, publicKey);
  if (!ok) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  let interaction: {
    application_id?: string;
    channel_id?: string;
    data?: {
      name?: string;
      options?: { name?: string; value?: string }[];
    };
    member?: { user?: { id?: string } };
    type: number;
    user?: { id?: string };
  };
  try {
    const text = new TextDecoder().decode(rawBody);
    interaction = JSON.parse(text) as typeof interaction;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (interaction.type === 1) {
    return jsonResponse({ type: 1 });
  }

  if (interaction.type !== 2) {
    return jsonResponse({ data: { content: "Unsupported interaction." }, type: 4 });
  }

  const name = interaction.data?.name;
  if (name !== "ftc") {
    return jsonResponse({
      data: { content: "Unknown command." },
      type: 4,
    });
  }

  let userText = "";
  for (const o of interaction.data?.options ?? []) {
    if (o?.name === "message" && typeof o.value === "string") {
      userText = o.value;
      break;
    }
  }
  userText = userText.trim();
  if (!userText) {
    return jsonResponse({
      data: { content: "Please provide a message." },
      type: 4,
    });
  }

  const discordUserId =
    interaction.user?.id ?? interaction.member?.user?.id ?? "";
  const linkedFtc = discordUserId
    ? await getLinkedFtcUserId({
        externalUserId: discordUserId,
        messagingChannelId: channelId,
        provider: "discord",
      })
    : null;
  const ftcUserId = linkedFtc ?? row.userId;

  const threadKey = `dc-${interaction.channel_id ?? "dm"}-${discordUserId || "unknown"}`;
  const convoId = messagingConversationId(channelId, threadKey);

  const result = await generateMessagingAgentReply({
    conversationId: convoId,
    userId: ftcUserId,
    userText,
  });

  if (!result.ok) {
    const err =
      result.error === "quota"
        ? "Free message limit reached. Upgrade to continue."
        : result.error === "no_ai"
          ? "AI is not configured."
          : "Something went wrong.";
    return jsonResponse({
      data: { content: err.slice(0, 2000) },
      type: 4,
    });
  }

  return jsonResponse({
    data: { content: result.text.slice(0, 2000) },
    type: 4,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

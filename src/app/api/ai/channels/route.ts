import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { db } from "~/db";
import {
  AI_MESSAGING_PROVIDER_VALUES,
  aiMessagingChannelTable,
  type AiMessagingProvider,
} from "~/db/schema/ai-chat/tables";
import { auth } from "~/lib/auth";
import { getPublicAppBaseUrl } from "~/lib/messaging/public-url";

interface ChannelPayload {
  /** Credentials saved (token + signing/interaction secrets as required). */
  credentialsComplete: boolean;
  discordApplicationIdMasked: null | string;
  discordLinkCode: null | string;
  discordPublicKeyMasked: null | string;
  id: string;
  provider: string;
  slackAppIdMasked: null | string;
  slackLinkCode: null | string;
  slackSigningSecretMasked: null | string;
  telegramBotTokenMasked: null | string;
  telegramChatLinked: boolean;
  telegramLinkCode: null | string;
  telegramLinkUrl: null | string;
  telegramTokenSet: boolean;
  webhookPath: string;
  webhookUrl: null | string;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildChannelsPayload(session.user.id);
  return NextResponse.json(payload);
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let body: {
    discord?: {
      applicationId?: string;
      botToken?: string;
      publicKey?: string;
    };
    slack?: { appId?: string; botToken?: string; signingSecret?: string };
    telegram?: { botToken?: string };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const baseUrl = getPublicAppBaseUrl();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (body.telegram !== undefined) {
    const row = await getOrCreateChannelRow(userId, "telegram");
    const token =
      typeof body.telegram.botToken === "string"
        ? body.telegram.botToken.trim()
        : "";

    if (!token) {
      if (row.telegramBotToken?.trim()) {
        try {
          await telegramDeleteWebhook(row.telegramBotToken.trim());
        } catch {
          // ignore
        }
      }
      await db
        .update(aiMessagingChannelTable)
        .set({
          linkedAt: null,
          telegramBotToken: null,
          telegramChatId: null,
          telegramLinkCode: null,
          telegramWebhookSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(aiMessagingChannelTable.id, row.id));
    } else {
      const webhookSecret = randomBytes(24).toString("hex");
      const linkCode = randomBytes(6).toString("hex");
      if (baseUrl) {
        try {
          await telegramSetWebhook(
            token,
            `${baseUrl}/api/webhooks/telegram/${row.id}`,
            webhookSecret,
          );
        } catch (e) {
          errors.push(
            e instanceof Error ? e.message : "Telegram setWebhook failed",
          );
        }
      } else {
        warnings.push(
          "Telegram could not register a webhook because the site’s public URL is not available yet. Your bot token was saved—try saving again in a moment, or contact support if messages still do not arrive.",
        );
      }
      if (errors.length === 0) {
        await db
          .update(aiMessagingChannelTable)
          .set({
            linkedAt: null,
            telegramBotToken: token,
            telegramChatId: null,
            telegramLinkCode: linkCode,
            telegramWebhookSecret: webhookSecret,
            updatedAt: new Date(),
          })
          .where(eq(aiMessagingChannelTable.id, row.id));
      }
    }
  }

  if (body.discord !== undefined) {
    const row = await getOrCreateChannelRow(userId, "discord");
    const botToken =
      typeof body.discord.botToken === "string"
        ? body.discord.botToken.trim()
        : "";
    const publicKey =
      typeof body.discord.publicKey === "string"
        ? body.discord.publicKey.trim()
        : "";
    const applicationId =
      typeof body.discord.applicationId === "string"
        ? body.discord.applicationId.trim()
        : "";

    if (!botToken || !publicKey || !applicationId) {
      await db
        .update(aiMessagingChannelTable)
        .set({
          discordApplicationId: null,
          discordBotToken: null,
          discordLinkCode: null,
          discordPublicKey: null,
          updatedAt: new Date(),
        })
        .where(eq(aiMessagingChannelTable.id, row.id));
    } else {
      try {
        await registerDiscordSlashCommand(applicationId, botToken);
      } catch (e) {
        errors.push(
          e instanceof Error
            ? e.message
            : "Discord command registration failed",
        );
      }
      if (errors.length === 0) {
        await db
          .update(aiMessagingChannelTable)
          .set({
            discordApplicationId: applicationId,
            discordBotToken: botToken,
            discordLinkCode: randomBytes(6).toString("hex"),
            discordPublicKey: publicKey,
            updatedAt: new Date(),
          })
          .where(eq(aiMessagingChannelTable.id, row.id));
      }
    }
  }

  if (body.slack !== undefined) {
    const row = await getOrCreateChannelRow(userId, "slack");
    const botToken =
      typeof body.slack.botToken === "string" ? body.slack.botToken.trim() : "";
    const signingSecret =
      typeof body.slack.signingSecret === "string"
        ? body.slack.signingSecret.trim()
        : "";
    const appId =
      typeof body.slack.appId === "string" ? body.slack.appId.trim() : "";

    if (!botToken || !signingSecret) {
      await db
        .update(aiMessagingChannelTable)
        .set({
          slackAppId: null,
          slackBotToken: null,
          slackLinkCode: null,
          slackSigningSecret: null,
          slackTeamId: null,
          updatedAt: new Date(),
        })
        .where(eq(aiMessagingChannelTable.id, row.id));
    } else {
      await db
        .update(aiMessagingChannelTable)
        .set({
          slackAppId: appId || null,
          slackBotToken: botToken,
          slackLinkCode: randomBytes(6).toString("hex"),
          slackSigningSecret: signingSecret,
          updatedAt: new Date(),
        })
        .where(eq(aiMessagingChannelTable.id, row.id));
    }
  }

  const payload = await buildChannelsPayload(userId);

  if (errors.length) {
    return NextResponse.json(
      { ...payload, errors, saved: false, warnings },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ...payload,
    errors: [],
    saved: true,
    warnings,
  });
}

async function buildChannelsPayload(userId: string): Promise<{
  baseUrl: string;
  channels: Record<string, ChannelPayload>;
}> {
  const baseUrl = getPublicAppBaseUrl();
  const out: Record<string, ChannelPayload> = {};

  for (const provider of AI_MESSAGING_PROVIDER_VALUES) {
    const row = await getOrCreateChannelRow(userId, provider);
    const webhookPath = `/api/webhooks/${provider}/${row.id}`;
    const webhookUrl = baseUrl ? `${baseUrl}${webhookPath}` : null;

    const telegramTokenSet = Boolean(row.telegramBotToken?.trim());
    const telegramChatLinked = Boolean(
      row.telegramChatId?.trim() && row.linkedAt,
    );

    const discordComplete = Boolean(
      row.discordBotToken?.trim() &&
        row.discordPublicKey?.trim() &&
        row.discordApplicationId?.trim(),
    );

    const slackComplete = Boolean(
      row.slackBotToken?.trim() && row.slackSigningSecret?.trim(),
    );

    const credentialsComplete =
      provider === "telegram"
        ? telegramTokenSet
        : provider === "discord"
          ? discordComplete
          : slackComplete;

    let telegramLinkUrl: null | string = null;
    if (
      provider === "telegram" &&
      row.telegramBotToken?.trim() &&
      row.telegramLinkCode
    ) {
      const u = await telegramGetBotUsername(row.telegramBotToken.trim());
      if (u) {
        telegramLinkUrl = `https://t.me/${u}?start=${row.telegramLinkCode}`;
      }
    }

    out[provider] = {
      credentialsComplete,
      discordApplicationIdMasked: maskSecret(row.discordApplicationId),
      discordLinkCode: provider === "discord" ? row.discordLinkCode : null,
      discordPublicKeyMasked: maskSecret(row.discordPublicKey),
      id: row.id,
      provider,
      slackAppIdMasked: maskSecret(row.slackAppId),
      slackLinkCode: provider === "slack" ? row.slackLinkCode : null,
      slackSigningSecretMasked: maskSecret(row.slackSigningSecret),
      telegramBotTokenMasked: maskSecret(row.telegramBotToken),
      telegramChatLinked,
      telegramLinkCode: row.telegramLinkCode,
      telegramLinkUrl,
      telegramTokenSet,
      webhookPath,
      webhookUrl,
    };
  }

  return { baseUrl, channels: out };
}

async function getOrCreateChannelRow(
  userId: string,
  provider: AiMessagingProvider,
) {
  const existing = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(
      and(
        eq(aiMessagingChannelTable.userId, userId),
        eq(aiMessagingChannelTable.provider, provider),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const id = createId();
  await db.insert(aiMessagingChannelTable).values({
    id,
    provider,
    userId,
  });
  const created = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(eq(aiMessagingChannelTable.id, id))
    .limit(1);
  return created[0]!;
}

function maskSecret(s: null | string | undefined): null | string {
  if (!s?.trim()) return null;
  const t = s.trim();
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

async function registerDiscordSlashCommand(
  applicationId: string,
  botToken: string,
): Promise<void> {
  const r = await fetch(
    `https://discord.com/api/v10/applications/${encodeURIComponent(applicationId)}/commands`,
    {
      body: JSON.stringify([
        {
          description: "Ask the For the Cult assistant",
          name: "ftc",
          options: [
            {
              description: "Your message",
              name: "message",
              required: true,
              type: 3,
            },
          ],
          type: 1,
        },
      ]),
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      method: "PUT",
    },
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Discord command registration failed");
  }
}

async function telegramDeleteWebhook(token: string): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(token)}/deleteWebhook`,
    {
      body: JSON.stringify({ drop_pending_updates: true }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

async function telegramGetBotUsername(token: string): Promise<null | string> {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`,
    );
    const j = (await r.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (!j.ok || !j.result?.username) return null;
    return j.result.username;
  } catch {
    return null;
  }
}

async function telegramSetWebhook(
  token: string,
  webhookUrl: string,
  secretToken: string,
): Promise<void> {
  const r = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(token)}/setWebhook`,
    {
      body: JSON.stringify({
        allowed_updates: ["message"],
        secret_token: secretToken,
        url: webhookUrl,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const j = (await r.json()) as { description?: string; ok?: boolean };
  if (!j.ok) {
    throw new Error(j.description ?? "setWebhook failed");
  }
}

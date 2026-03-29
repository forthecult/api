/**
 * Discord Gateway worker: receives DM messages (no slash commands) and POSTs
 * to the internal `/api/internal/messaging/discord-dm` route.
 *
 * Run (example):
 *   MESSAGING_INTERNAL_SECRET=... APP_BASE_URL=https://your.domain bun run src/scripts/discord-gateway-worker.ts
 *
 * Enable in the Discord Developer Portal for your bot:
 * - Privileged Gateway Intent: **Message Content Intent**
 * - Gateway Intent: enable **Direct Messages** (and Message Content as above).
 *
 * Deploy this as a long-lived process (container, VPS, or process manager). It is
 * not suitable for serverless.
 */
import "dotenv/config";
import { and, eq, isNotNull } from "drizzle-orm";
import WebSocket from "ws";

import { db } from "~/db";
import { aiMessagingChannelTable } from "~/db/schema/ai-chat/tables";

/** DIRECT_MESSAGES (4096) | MESSAGE_CONTENT (32768) */
const INTENTS = (1 << 12) | (1 << 15);

interface GatewayPayload {
  d?: unknown;
  op: number;
  s?: null | number;
  t?: string;
}

function connectBot(row: typeof aiMessagingChannelTable.$inferSelect) {
  const token = row.discordBotToken?.trim();
  if (!token) return;

  let seq: null | number = null;
  let heartbeat: null | ReturnType<typeof setInterval> = null;

  const clearHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  async function run(): Promise<void> {
    const urlRes = await fetch("https://discord.com/api/v10/gateway/bot", {
      headers: { Authorization: `Bot ${token}` },
    });
    const gw = (await urlRes.json()) as { url?: string };
    if (!gw.url) {
      console.error("discord-gateway: gateway/bot failed for row", row.id);
      setTimeout(() => void run(), 10_000);
      return;
    }

    const wsUrl = `${gw.url}?v=10&encoding=json`;
    const ws = new WebSocket(wsUrl);

    ws.on("message", (raw: WebSocket.RawData) => {
      let payload: GatewayPayload;
      try {
        payload = JSON.parse(String(raw)) as GatewayPayload;
      } catch {
        return;
      }

      if (payload.s != null) seq = payload.s;

      if (payload.op === 10) {
        const hello = payload.d as { heartbeat_interval: number };
        clearHeartbeat();
        const interval = hello.heartbeat_interval;
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ d: seq, op: 1 }));
          }
        }, interval);

        ws.send(
          JSON.stringify({
            d: {
              intents: INTENTS,
              properties: {
                browser: "ftc-gateway",
                device: "ftc-gateway",
                os: "linux",
              },
              token,
            },
            op: 2,
          }),
        );
      }

      if (payload.op === 0 && payload.t === "MESSAGE_CREATE") {
        const d = payload.d as {
          author?: { bot?: boolean; id: string };
          channel_id: string;
          content?: string;
          guild_id?: null | string;
        };
        if (d.guild_id) return;
        if (!d.author?.id || d.author.bot) return;
        const text = d.content?.trim() ?? "";
        if (!text) return;
        void postDm({
          authorId: d.author.id,
          content: text,
          discordChannelId: d.channel_id,
          rowId: row.id,
        });
      }
    });

    ws.on("close", () => {
      clearHeartbeat();
      setTimeout(() => void run(), 5000);
    });

    ws.on("error", (err) => {
      console.error("discord-gateway: ws error", row.id, err);
    });
  }

  void run();
}

async function main(): Promise<void> {
  const rows = await db
    .select()
    .from(aiMessagingChannelTable)
    .where(
      and(
        eq(aiMessagingChannelTable.provider, "discord"),
        isNotNull(aiMessagingChannelTable.discordBotToken),
      ),
    );

  let n = 0;
  for (const r of rows) {
    if (!r.discordBotToken?.trim()) continue;
    connectBot(r);
    n += 1;
  }
  console.log(`discord-gateway: started ${n} connection(s)`);
}

async function postDm(options: {
  authorId: string;
  content: string;
  discordChannelId: string;
  rowId: string;
}): Promise<void> {
  const base = (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const secret = process.env.MESSAGING_INTERNAL_SECRET?.trim();
  if (!base || !secret) {
    console.error(
      "discord-gateway: set APP_BASE_URL and MESSAGING_INTERNAL_SECRET",
    );
    return;
  }
  const url = `${base}/api/internal/messaging/discord-dm`;
  const res = await fetch(url, {
    body: JSON.stringify({
      authorId: options.authorId,
      channelId: options.rowId,
      content: options.content,
      discordChannelId: options.discordChannelId,
    }),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!res.ok) {
    console.error(
      "discord-gateway: internal dm failed",
      options.rowId,
      res.status,
      await res.text(),
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

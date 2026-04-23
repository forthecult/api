"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface ChannelPayload {
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

interface ChannelsResponse {
  baseUrl: string;
  channels: Record<string, ChannelPayload>;
  errors?: string[];
  saved?: boolean;
  warnings?: string[];
}

export function DashboardAiChannelsClient() {
  const [payload, setPayload] = React.useState<ChannelsResponse | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const [telegramToken, setTelegramToken] = React.useState("");
  const [discordAppId, setDiscordAppId] = React.useState("");
  const [discordPublicKey, setDiscordPublicKey] = React.useState("");
  const [discordBotToken, setDiscordBotToken] = React.useState("");
  const [slackBotToken, setSlackBotToken] = React.useState("");
  const [slackSigningSecret, setSlackSigningSecret] = React.useState("");
  const [slackAppId, setSlackAppId] = React.useState("");

  const [savingTelegram, setSavingTelegram] = React.useState(false);
  const [savingDiscord, setSavingDiscord] = React.useState(false);
  const [savingSlack, setSavingSlack] = React.useState(false);
  const [notice, setNotice] = React.useState<null | string>(null);

  const refresh = React.useCallback(async () => {
    setLoadError(false);
    const res = await fetch("/api/ai/channels");
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    const json = (await res.json()) as ChannelsResponse;
    setPayload(json);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const baseUrl = payload?.baseUrl ?? "";

  async function saveTelegram() {
    setSavingTelegram(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({
          telegram: { botToken: telegramToken },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setTelegramToken("");
      if (json.errors?.length) {
        setNotice(json.errors.join(" "));
      } else if (json.warnings?.length) {
        setNotice(json.warnings.join(" "));
      } else {
        setNotice("Telegram settings saved.");
      }
    } catch {
      setNotice("Could not save Telegram settings.");
    } finally {
      setSavingTelegram(false);
    }
  }

  async function clearTelegram() {
    setSavingTelegram(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({ telegram: { botToken: "" } }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setTelegramToken("");
      setNotice("Telegram disconnected.");
    } catch {
      setNotice("Could not clear Telegram.");
    } finally {
      setSavingTelegram(false);
    }
  }

  async function saveDiscord() {
    setSavingDiscord(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({
          discord: {
            applicationId: discordAppId,
            botToken: discordBotToken,
            publicKey: discordPublicKey,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setDiscordAppId("");
      setDiscordPublicKey("");
      setDiscordBotToken("");
      if (json.errors?.length) {
        setNotice(json.errors.join(" "));
      } else {
        setNotice("Discord settings saved.");
      }
    } catch {
      setNotice("Could not save Discord settings.");
    } finally {
      setSavingDiscord(false);
    }
  }

  async function clearDiscord() {
    setSavingDiscord(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({
          discord: { applicationId: "", botToken: "", publicKey: "" },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setNotice("Discord cleared.");
    } catch {
      setNotice("Could not clear Discord.");
    } finally {
      setSavingDiscord(false);
    }
  }

  async function saveSlack() {
    setSavingSlack(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({
          slack: {
            appId: slackAppId || undefined,
            botToken: slackBotToken,
            signingSecret: slackSigningSecret,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setSlackBotToken("");
      setSlackSigningSecret("");
      setSlackAppId("");
      if (json.errors?.length) {
        setNotice(json.errors.join(" "));
      } else {
        setNotice("Slack settings saved.");
      }
    } catch {
      setNotice("Could not save Slack settings.");
    } finally {
      setSavingSlack(false);
    }
  }

  async function clearSlack() {
    setSavingSlack(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/channels", {
        body: JSON.stringify({
          slack: { appId: "", botToken: "", signingSecret: "" },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const json = (await res.json()) as ChannelsResponse;
      setPayload(json);
      setNotice("Slack cleared.");
    } catch {
      setNotice("Could not clear Slack.");
    } finally {
      setSavingSlack(false);
    }
  }

  const tg = payload?.channels?.telegram;
  const dc = payload?.channels?.discord;
  const sl = payload?.channels?.slack;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Channels &amp; integrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect your agent to Telegram, Discord, and Slack.
        </p>
      </div>

      <div
        className={`
          rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm
          text-amber-950
          dark:text-amber-100
        `}
      >
        <p className="font-medium">Integration URLs</p>
        <p className="mt-1 text-muted-foreground">
          {baseUrl ? (
            <>
              Webhook and callback URLs use this site address:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {baseUrl}
              </code>
              . If anything looks incorrect, contact support.
            </>
          ) : (
            <>
              Your public site address for integrations could not be determined
              right now. You can still copy the webhook paths below; if
              Telegram, Discord, or Slack do not connect after you save, try
              again later or contact support.
            </>
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {loadError ? (
        <p className="text-sm text-destructive">Could not load channels.</p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>
            Create a telegram bot with{" "}
            <a
              className="text-primary underline"
              href="https://t.me/BotFather"
              rel="noreferrer"
              target="_blank"
            >
              @BotFather
            </a>
            , paste the token, save, then open the telegram link provided once to link your
            chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-medium">Webhook URL</span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {tg?.webhookUrl ?? "(save token first)"}
              </code>
            </p>
            {tg?.telegramBotTokenMasked ? (
              <p className="text-muted-foreground">
                Token on file: {tg.telegramBotTokenMasked}
              </p>
            ) : null}
            {tg?.telegramLinkUrl ? (
              <p>
                <span className="font-medium">Link this chat</span>{" "}
                <a
                  className="text-primary underline"
                  href={tg.telegramLinkUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {tg.telegramLinkUrl}
                </a>
              </p>
            ) : null}
            {tg?.telegramChatLinked ? (
              <p
                className={`
                  text-emerald-600
                  dark:text-emerald-400
                `}
              >
                Telegram chat linked.
              </p>
            ) : null}
          </div>
          <div className="grid max-w-lg gap-2">
            <Label htmlFor="tg-token">Bot token</Label>
            <Input
              autoComplete="off"
              id="tg-token"
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="123456:ABC…"
              type="password"
              value={telegramToken}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={savingTelegram}
              onClick={() => void saveTelegram()}
              type="button"
            >
              {savingTelegram ? "Saving…" : "Save Telegram"}
            </Button>
            <Button
              disabled={savingTelegram || !tg?.telegramTokenSet}
              onClick={() => void clearTelegram()}
              type="button"
              variant="outline"
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discord</CardTitle>
          <CardDescription>
            Create an application at{" "}
            <a
              className="text-primary underline"
              href="https://discord.com/developers/applications"
              rel="noreferrer"
              target="_blank"
            >
              Discord Developer Portal
            </a>
            , enable the bot, copy the application ID, public key, and bot
            token. Set the Interactions endpoint URL to the webhook below
            (POST). We register a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/ftc</code>{" "}
            slash command with a{" "}
            <code className={`rounded bg-muted px-1 py-0.5 text-xs`}>
              message
            </code>{" "}
            option.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Interactions URL</span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">
                {dc?.webhookUrl ?? "(configure after save)"}
              </code>
            </p>
            {dc?.discordApplicationIdMasked ? (
              <p className="text-muted-foreground">
                Application ID: {dc.discordApplicationIdMasked}
              </p>
            ) : null}
            {dc?.discordLinkCode ? (
              <p>
                <span className="font-medium">
                  Link your FTC account (slash + DM)
                </span>{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">
                  {dc.discordLinkCode}
                </code>{" "}
                — message the bot{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  ftc link {dc.discordLinkCode}
                </code>{" "}
                or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  link {dc.discordLinkCode}
                </code>
                .
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                DM chat (no slash):
              </span>{" "}
              run the long-lived gateway worker (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                bun run discord-gateway
              </code>
              ) with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                APP_BASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                MESSAGING_INTERNAL_SECRET
              </code>
              . Enable Message Content + Direct Messages intents for the bot.
            </p>
          </div>
          <div className="grid max-w-lg gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dc-app">Application ID</Label>
              <Input
                autoComplete="off"
                id="dc-app"
                onChange={(e) => setDiscordAppId(e.target.value)}
                value={discordAppId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dc-pk">Public key (hex)</Label>
              <Input
                autoComplete="off"
                id="dc-pk"
                onChange={(e) => setDiscordPublicKey(e.target.value)}
                value={discordPublicKey}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dc-bot">Bot token</Label>
              <Input
                autoComplete="off"
                id="dc-bot"
                onChange={(e) => setDiscordBotToken(e.target.value)}
                type="password"
                value={discordBotToken}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={savingDiscord}
              onClick={() => void saveDiscord()}
              type="button"
            >
              {savingDiscord ? "Saving…" : "Save Discord"}
            </Button>
            <Button
              disabled={savingDiscord || !dc?.credentialsComplete}
              onClick={() => void clearDiscord()}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slack</CardTitle>
          <CardDescription>
            Create a Slack app with the Events API. Enable{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              message.channels
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              message.im
            </code>{" "}
            (or the scopes your workspace needs), install the app, then paste
            the bot token and signing secret. Request URL:
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">
              {sl?.webhookUrl ?? "(configure after save)"}
            </code>
          </p>
          {sl?.slackSigningSecretMasked ? (
            <p className="text-sm text-muted-foreground">
              Signing secret on file: {sl.slackSigningSecretMasked}
            </p>
          ) : null}
          {sl?.slackLinkCode ? (
            <p className="text-sm">
              <span className="font-medium">Link your FTC account</span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">
                {sl.slackLinkCode}
              </code>{" "}
              — message the app{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                ftc link {sl.slackLinkCode}
              </code>
            </p>
          ) : null}
          <div className="grid max-w-lg gap-3">
            <div className="grid gap-2">
              <Label htmlFor="sl-bot">Bot User OAuth token</Label>
              <Input
                autoComplete="off"
                id="sl-bot"
                onChange={(e) => setSlackBotToken(e.target.value)}
                type="password"
                value={slackBotToken}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sl-sign">Signing secret</Label>
              <Input
                autoComplete="off"
                id="sl-sign"
                onChange={(e) => setSlackSigningSecret(e.target.value)}
                type="password"
                value={slackSigningSecret}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sl-app">App ID (optional)</Label>
              <Input
                autoComplete="off"
                id="sl-app"
                onChange={(e) => setSlackAppId(e.target.value)}
                value={slackAppId}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={savingSlack}
              onClick={() => void saveSlack()}
              type="button"
            >
              {savingSlack ? "Saving…" : "Save Slack"}
            </Button>
            <Button
              disabled={savingSlack || !sl?.credentialsComplete}
              onClick={() => void clearSlack()}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (coming soon)</CardTitle>
          <CardDescription>
            Support coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={`flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground`}
        >
        </CardContent>
      </Card>

      <section
        className={`
          rounded-xl border border-dashed border-border bg-muted/20 p-4
        `}
      >
        <h2 className="text-sm font-semibold text-foreground">
          SMS &amp; voice (under development)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We are working on providing this service. Voice and SMS conversations are not private. We recommend using our website or an encrypted messaging service if you want to increase your privacy.
        </p>
      </section>
    </div>
  );
}

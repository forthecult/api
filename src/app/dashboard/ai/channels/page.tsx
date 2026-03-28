import type { Metadata } from "next";

import Link from "next/link";

export const metadata: Metadata = {
  title: "AI channels",
};

const CHANNELS = [
  {
    body: (
      <>
        Use the{" "}
        <a
          className="text-primary underline"
          href="https://core.telegram.org/bots/api"
          rel="noreferrer"
          target="_blank"
        >
          Bot API
        </a>
        : create a bot with BotFather, host an HTTPS webhook (e.g.{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          POST /api/webhooks/telegram
        </code>
        ) that verifies{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          X-Telegram-Bot-Api-Secret-Token
        </code>
        , maps <code className="rounded bg-muted px-1 py-0.5 text-xs">chat_id</code>{" "}
        → your user, and forwards text into the same pipeline as{" "}
        <Link className="text-primary underline" href="/chat">
          /chat
        </Link>
        . Fast path: long-polling in a worker if you skip webhooks.
      </>
    ),
    name: "Telegram",
  },
  {
    body: (
      <>
        <strong>WhatsApp Cloud API</strong> (Meta): business verification, phone
        number, and webhook for inbound messages. Alternative:{" "}
        <strong>Twilio WhatsApp</strong> or MessageBird if you want a single SMS
        + WhatsApp vendor.
      </>
    ),
    name: "WhatsApp",
  },
  {
    body: (
      <>
        <a
          className="text-primary underline"
          href="https://discord.com/developers/docs/topics/gateway"
          rel="noreferrer"
          target="_blank"
        >
          Discord
        </a>{" "}
        bots use a bot token + Gateway or Interactions; good for communities,
        not 1:1 SMS.
      </>
    ),
    name: "Discord",
  },
  {
    body: (
      <>
        <a
          className="text-primary underline"
          href="https://api.slack.com/"
          rel="noreferrer"
          target="_blank"
        >
          Slack
        </a>{" "}
        apps use OAuth + Events API; map Slack user → FTC account via a &quot;Connect
        Slack&quot; button and store tokens encrypted server-side.
      </>
    ),
    name: "Slack",
  },
  {
    body: (
      <>
        Bridges (Matrix, Signal, etc.) are possible but usually need separate
        infrastructure or compliance review; treat as phase 2 after Telegram +
        WhatsApp.
      </>
    ),
    name: "Other",
  },
] as const;

export default function DashboardAiChannelsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Channels &amp; integrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Roadmap for wiring your same assistant to other chat surfaces. Nothing
          here is required for the web chat at{" "}
          <Link className="text-primary underline" href="/chat">
            /chat
          </Link>
          .
        </p>
      </div>

      <ul className="space-y-4">
        {CHANNELS.map((c) => (
          <li
            className="rounded-xl border border-border bg-card p-4"
            key={c.name}
          >
            <h2 className="text-sm font-semibold">{c.name}</h2>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {c.body}
            </div>
          </li>
        ))}
      </ul>

      <section className={`
        rounded-xl border border-dashed border-border bg-muted/20 p-4
      `}>
        <h2 className="text-sm font-semibold text-foreground">
          SMS &amp; voice (scoping only)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Yes — <strong>SMS and PSTN voice</strong> almost always go through a
          carrier aggregator (e.g.{" "}
          <strong className="text-foreground">Twilio</strong>, Vonage, Bandwidth,
          Plivo). You buy or port a number, enable programmable SMS/voice, and
          point webhooks at your app. Scope includes: user consent and opt-out,
          regional rules (TCPA, GDPR marketing rules), rate limits, cost per
          segment, and spam/abuse handling. Voice adds real-time media or
          Twilio&apos;s speech bridges if you do not run your own telephony stack.
          Keep SMS/voice as a <strong>separate product surface</strong> from
          in-app chat: different UX, billing, and compliance — implement after
          messaging channels (Telegram/WhatsApp) are stable.
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";

import Link from "next/link";

import { DashboardAiWidgetToggle } from "~/app/dashboard/ai/dashboard-ai-widget-toggle";
import { Button } from "~/ui/primitives/button";

export const metadata: Metadata = {
  title: "AI settings",
};

export default function DashboardAiPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage your assistant, memories, local chats, and encrypted backups.
          Use the sidebar to open Storage &amp; data or Prompts &amp; memory.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/ai/storage">Storage &amp; data</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/ai/prompts">Prompts &amp; memory</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/ai/cloud">Cloud data</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/ai/channels">Channels</Link>
        </Button>
        <Button asChild>
          <Link href="/chat">Open AI chat</Link>
        </Button>
      </div>

      <DashboardAiWidgetToggle />

      <p className="max-w-xl text-sm text-muted-foreground">
        See{" "}
        <Link className="text-primary underline" href="/dashboard/ai/channels">
          Channels
        </Link>{" "}
        for how Telegram, WhatsApp, Slack, and similar integrations are scoped.
        SMS/voice is a separate layer (typically Twilio-class providers).
      </p>
    </div>
  );
}

import type { Metadata } from "next";

import Link from "next/link";

import { DashboardAiWidgetToggle } from "~/app/dashboard/ai/dashboard-ai-widget-toggle";
import { Button } from "~/ui/primitives/button";

export const metadata: Metadata = {
  title: "AI settings",
};

export default function DashboardAiPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Account-level preferences and backups will live here. Pick a character
        and chat on the chat page—messages stay in your browser unless you use a
        backup flow when we ship it.
      </p>

      <DashboardAiWidgetToggle />

      <p className="max-w-xl text-sm text-muted-foreground">
        Coming later for paid plans: connect your AI to other chat surfaces
        (Telegram, WhatsApp, and similar) so you can talk to your assistant
        wherever you already message.
      </p>

      <Button asChild>
        <Link href="/chat">Open AI chat</Link>
      </Button>
    </div>
  );
}

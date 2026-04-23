import type { Metadata } from "next";

import Link from "next/link";

import { DashboardAiWidgetToggle } from "~/app/dashboard/ai/dashboard-ai-widget-toggle";
import { Button } from "~/ui/primitives/button";

export const metadata: Metadata = {
  title: "AI settings",
};

export default function DashboardAiPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage your agent, memories, local chats, and encrypted backups.
        </p>
      </div>

    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/chat">Open chat</Link>
      </Button>
    </div>

      <DashboardAiWidgetToggle />
    </div>
  );
}

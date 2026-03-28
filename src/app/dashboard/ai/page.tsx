import type { Metadata } from "next";

import Link from "next/link";

import { Button } from "~/ui/primitives/button";

export const metadata: Metadata = {
  title: "AI settings",
};

export default function DashboardAiPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
      <p className="text-muted-foreground max-w-xl text-sm">
        Manage character, memories, backups, and preferences. Full controls also
        appear on the chat page.
      </p>
      <Button asChild>
        <Link href="/chat">Open AI chat</Link>
      </Button>
    </div>
  );
}

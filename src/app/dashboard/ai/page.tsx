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
      <p className="max-w-xl text-sm text-muted-foreground">
        Account-level preferences and backups will live here. Pick a character
        and chat on the chat page—messages stay in your browser unless you use a
        backup flow when we ship it.
      </p>
      <Button asChild>
        <Link href="/chat">Open AI chat</Link>
      </Button>
    </div>
  );
}

import type { Metadata } from "next";

import { DashboardAiPromptsClient } from "~/app/dashboard/ai/prompts/dashboard-ai-prompts-client";

export const metadata: Metadata = {
  title: "AI prompts & memory",
};

export default function DashboardAiPromptsPage() {
  return <DashboardAiPromptsClient />;
}

import type { Metadata } from "next";

import { DashboardAiStorageClient } from "~/app/dashboard/ai/storage/dashboard-ai-storage-client";

export const metadata: Metadata = {
  title: "AI storage",
};

export default function DashboardAiStoragePage() {
  return <DashboardAiStorageClient />;
}

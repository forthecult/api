import type { Metadata } from "next";

import { DashboardAiCloudClient } from "~/app/dashboard/ai/cloud/dashboard-ai-cloud-client";

export const metadata: Metadata = {
  title: "AI cloud data",
};

export default function DashboardAiCloudPage() {
  return <DashboardAiCloudClient />;
}

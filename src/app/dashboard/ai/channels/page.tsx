import type { Metadata } from "next";

import { DashboardAiChannelsClient } from "./page.client";

export const metadata: Metadata = {
  title: "AI channels",
};

export default function DashboardAiChannelsPage() {
  return <DashboardAiChannelsClient />;
}

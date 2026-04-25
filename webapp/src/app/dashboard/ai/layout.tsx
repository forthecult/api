import { AiSettingsLayout } from "~/app/dashboard/ai/ai-settings-layout";

export default function DashboardAiSectionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AiSettingsLayout>{children}</AiSettingsLayout>;
}

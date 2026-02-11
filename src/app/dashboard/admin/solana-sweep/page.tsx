import { redirect } from "next/navigation";

import { getCurrentUserOrRedirect, isAdminUser } from "~/lib/auth";

import { SolanaSweepPageClient } from "./page.client";

export const dynamic = "force-dynamic";

export default async function SolanaSweepAdminPage() {
  const user = await getCurrentUserOrRedirect();
  if (!user || !isAdminUser(user)) {
    redirect("/dashboard");
  }
  return <SolanaSweepPageClient />;
}

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { SEO_CONFIG } from "~/app";
import { getPageTokenGates } from "~/lib/token-gate";
import { hasValidTokenGateCookie, COOKIE_NAME } from "~/lib/token-gate-cookie";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { StatsPageClient } from "./page.client";

export const metadata: Metadata = {
  title: `Store statistics | ${SEO_CONFIG.name}`,
  description: "Store statistics: orders, sales, support, and chat metrics.",
  robots: "noindex, nofollow",
};

export default async function StatsPage() {
  const config = await getPageTokenGates("stats");
  if (config.tokenGated) {
    const cookieStore = await cookies();
    const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
    const passed = hasValidTokenGateCookie(tgCookie, "page", "stats");
    if (!passed) {
      return <TokenGateGuard resourceType="page" resourceId="stats" />;
    }
  }

  return (
    <div
      className={`
        container mx-auto flex min-h-0 flex-1 flex-col
        gap-4 px-4 py-6 md:gap-8 md:px-6
      `}
    >
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Store statistics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of orders, sales, support tickets, and chats.
        </p>
      </header>
      <StatsPageClient />
    </div>
  );
}

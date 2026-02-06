import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { StatsPageClient } from "./page.client";

export const metadata: Metadata = {
  title: `Store statistics | ${SEO_CONFIG.name}`,
  description: "Store statistics: orders, sales, support, and chat metrics.",
  robots: "noindex, nofollow",
};

export default function StatsPage() {
  return (
    <TokenGateGuard resourceType="page" resourceId="stats">
      <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Store statistics
          </h1>
          <p className="mt-2 text-muted-foreground">
            Overview of orders, sales, support tickets, and chats.
          </p>
        </header>
        <StatsPageClient />
      </div>
    </TokenGateGuard>
  );
}

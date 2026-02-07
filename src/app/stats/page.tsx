import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";
import { PageTokenGate } from "~/ui/components/token-gate/PageTokenGate";
import { StatsPageClient } from "./page.client";

/** Avoid prerender at build to prevent DB connection pool exhaustion (e.g. Neon Session mode). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Store statistics | ${SEO_CONFIG.name}`,
  description: "Store statistics: orders, sales, support, and chat metrics.",
  robots: "noindex, nofollow",
};

export default async function StatsPage() {
  return (
    <PageTokenGate slug="stats">
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
    </PageTokenGate>
  );
}

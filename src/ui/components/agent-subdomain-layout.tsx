import Link from "next/link";

import { getAgentBaseUrl } from "~/lib/app-url";

/**
 * Minimal layout for the AI subdomain (ai.forthecult.store).
 * No store header/footer/support chat — document-first, easy for agents to parse.
 * Uses absolute URLs so agents that scrape the page get full endpoint URLs.
 */
export function AgentSubdomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const base = getAgentBaseUrl() || "";
  const capabilitiesUrl = base ? `${base}/api/agent/capabilities` : "/api/agent/capabilities";

  return (
    <>
      <header
        className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900"
        role="banner"
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <Link
            href="/for-agents"
            className="font-mono text-sm font-medium text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            For the Cult — AI
          </Link>
          <span className="font-mono text-xs text-neutral-500">
            <Link href="/for-agents">/for-agents</Link>
            {" · "}
            <a
              href={capabilitiesUrl}
              className="text-blue-600 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
              data-endpoint="capabilities"
              data-method="GET"
            >
              Start: GET /api/agent/capabilities
            </a>
          </span>
        </div>
      </header>
      <main
        className="min-h-screen bg-white dark:bg-neutral-950"
        role="main"
        id="main-content"
      >
        {children}
      </main>
    </>
  );
}

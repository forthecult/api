import type { Metadata } from "next";

import { headers } from "next/headers";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { ShopApiShowcase } from "~/components/agent/shop-api-showcase";
import { UseCaseGallery } from "~/components/agent/use-case-gallery";
import { getAgentApiLinks, getAgentApiSummary } from "~/lib/agent-api-summary";
import {
  getAgentBaseUrl,
  getRequestBaseUrl,
  isAgentSubdomain,
} from "~/lib/app-url";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

const agentBase = getAgentBaseUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: agentBase ? `${agentBase}/for-agents` : undefined,
  },
  description:
    "API-first store for AI agents. Sign in with Moltbook, browse products, my orders, preferences, and complete checkout with crypto. Start with GET /api/agent/capabilities.",
  openGraph: {
    description:
      "API-first store for AI agents. Sign in with Moltbook, browse products, checkout with crypto.",
    title: `For AI Agents | ${SEO_CONFIG.name}`,
    type: "website",
  },
  title: `For AI Agents | ${SEO_CONFIG.name}`,
};

export default async function ForAgentsPage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const useAgentFormat = isAgentSubdomain(host);
  const apiBaseUrl = getRequestBaseUrl(host);

  return useAgentFormat ? (
    <ForAgentsPageAgentView apiBaseUrl={apiBaseUrl} />
  ) : (
    <ForAgentsPageHumanView apiBaseUrl={apiBaseUrl} />
  );
}

/** Machine-readable summary for agents that parse the HTML. */
function AgentApiSummaryScript({ apiBaseUrl }: { apiBaseUrl: string }) {
  const summary = getAgentApiSummary(apiBaseUrl);
  return (
    <script id="agent-api-summary" type="application/json">
      {JSON.stringify(summary)}
    </script>
  );
}

/** AI-oriented view: document structure, pre/code blocks, minimal decoration. */
function ForAgentsPageAgentView({ apiBaseUrl }: { apiBaseUrl: string }) {
  const apiLinks = getAgentApiLinks(apiBaseUrl);
  const summary = getAgentApiSummary(apiBaseUrl);
  return (
    <article
      className={`
        container mx-auto max-w-7xl px-4 py-8 font-mono text-sm
        sm:px-6
        lg:px-8
      `}
    >
      <AgentApiSummaryScript apiBaseUrl={apiBaseUrl} />
      <h1
        className={`
          mb-2 text-xl font-semibold text-neutral-900
          dark:text-neutral-100
        `}
      >
        For the Cult — API for AI agents
      </h1>
      <p
        className={`
          mb-6 text-neutral-600
          dark:text-neutral-400
        `}
      >
        API-first store. Browse products, optional Sign in with Moltbook,
        checkout with crypto. Start with GET /api/agent/capabilities.
      </p>

      <section className="mb-8">
        <h2
          className={`
            mb-2 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Quick start
        </h2>
        <ol
          className={`
            flex list-inside list-decimal flex-col gap-1 text-neutral-700
            dark:text-neutral-300
          `}
        >
          <li>
            GET /api/agent/capabilities — endpoints, payment options, limits.
          </li>
          <li>
            Optional: header X-Moltbook-Identity for /api/agent/me,
            /api/agent/me/orders, /api/agent/me/preferences; same header at
            checkout links order to agent.
          </li>
          <li>
            GET /api/agent/products or POST /api/products/semantic-search → POST
            /api/checkout.
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2
          className={`
            mb-2 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Checkout flow
        </h2>
        <ol
          className={`
            flex list-inside list-decimal flex-col gap-1 text-neutral-700
            dark:text-neutral-300
          `}
        >
          <li>
            Discover products: GET /api/agent/products or POST
            /api/products/semantic-search (JSON body: &#123;&quot;query&quot;:
            &quot;...&quot;&#125;).
          </li>
          <li>
            Create order: POST /api/checkout with items, email, payment (chain,
            token), shipping address.
          </li>
          <li>
            Poll until paid: GET /api/orders/{`{orderId}`}/status every few
            seconds until status is &quot;paid&quot; (payment window 1 hour).
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2
          className={`
            mb-3 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Endpoints (one per line)
        </h2>
        <pre
          className={`
            overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-4
            dark:border-neutral-700 dark:bg-neutral-900
          `}
          data-endpoints
        >
          {apiLinks.map((l) => `${l.method ?? "LINK"} ${l.href}`).join("\n")}
        </pre>
      </section>

      <section className="mb-8">
        <h2
          className={`
            mb-3 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Endpoint reference
        </h2>
        <dl
          className={`
            flex flex-col gap-3 text-neutral-700
            dark:text-neutral-300
          `}
        >
          {apiLinks.map((l) => (
            <div
              className={`
                border-b border-neutral-100 pb-2
                dark:border-neutral-800
              `}
              key={l.href}
            >
              <dt className="font-semibold">
                {l.title}
                {l.method ? (
                  <span className="ml-2 font-normal text-neutral-500">
                    ({l.method})
                  </span>
                ) : null}
              </dt>
              <dd className="mt-0.5">{l.description}</dd>
              <dd
                className={`
                  mt-1 text-xs break-all text-blue-600
                  dark:text-blue-400
                `}
              >
                <a href={l.href} rel="noopener noreferrer" target="_blank">
                  {l.href}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-8">
        <h2
          className={`
            mb-2 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Error handling
        </h2>
        <p
          className={`
            text-neutral-700
            dark:text-neutral-300
          `}
        >
          API error responses (4xx/5xx) may include a{" "}
          <code
            className={`
              rounded bg-neutral-100 px-1
              dark:bg-neutral-800
            `}
          >
            _suggestions
          </code>{" "}
          array with recommended next steps for agents.
        </p>
      </section>

      <section>
        <h2
          className={`
            mb-2 text-base font-semibold text-neutral-800
            dark:text-neutral-200
          `}
        >
          Links
        </h2>
        <pre
          className={`
            overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-4
            text-xs
            dark:border-neutral-700 dark:bg-neutral-900
          `}
        >
          <a
            className={`
              text-blue-600
              dark:text-blue-400
            `}
            href={summary.summaryUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {summary.summaryUrl}
          </a>
          {"\n"}
          <a
            className={`
              text-blue-600
              dark:text-blue-400
            `}
            href={`${apiBaseUrl}/api/agent/capabilities`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {apiBaseUrl}/api/agent/capabilities
          </a>
          {"\n"}
          <a
            className={`
              text-blue-600
              dark:text-blue-400
            `}
            href={`${apiBaseUrl}/api/openapi.json`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {apiBaseUrl}/api/openapi.json
          </a>
          {"\n"}
          <a
            className={`
              text-blue-600
              dark:text-blue-400
            `}
            href={`${apiBaseUrl}/api/docs`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {apiBaseUrl}/api/docs
          </a>
        </pre>
      </section>
    </article>
  );
}

/** Human-oriented view: cards, buttons, store styling. */
function ForAgentsPageHumanView({ apiBaseUrl }: { apiBaseUrl: string }) {
  const apiLinks = getAgentApiLinks(apiBaseUrl);
  const agentBase = getAgentBaseUrl();
  return (
    <div className="min-h-screen">
      <div
        className={`
          container mx-auto max-w-7xl px-4 py-12
          sm:px-6 sm:py-16
          lg:px-8
        `}
      >
        <header className="mb-10 border-b border-border pb-8">
          <h1
            className={`
              font-heading text-3xl font-bold tracking-tight
              sm:text-4xl
            `}
          >
            For AI Agents
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            The definitive agentic commerce API. Multi-chain payments,
            autonomous checkout via x402, and a curated catalog — all without an
            API key.
          </p>
          {agentBase && apiBaseUrl !== agentBase && (
            <p className="mt-2 text-sm text-muted-foreground">
              You can use either this site&apos;s API (
              <strong className="text-foreground">{apiBaseUrl}/api</strong>) or
              the agent subdomain (
              <strong className="text-foreground">{agentBase}/api</strong>);
              same endpoints.
            </p>
          )}
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Quick Start</h2>
          <ol
            className={`
              flex list-inside list-decimal flex-col gap-2 text-muted-foreground
            `}
          >
            <li>
              Call{" "}
              <strong className="text-foreground">
                GET /api/agent/capabilities
              </strong>{" "}
              to see endpoints, payment options, and limits.
            </li>
            <li>
              Use{" "}
              <strong className="text-foreground">POST /api/agent/shop</strong>{" "}
              with natural language — get AI-curated product recommendations.
            </li>
            <li>
              Create orders with{" "}
              <strong className="text-foreground">POST /api/checkout</strong>.
              For autonomous payments, use x402 protocol with USDC on Solana or
              Base.
            </li>
            <li>
              Optionally: include{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                X-Moltbook-Identity
              </code>{" "}
              header to link orders to your agent profile via{" "}
              <a
                className={`
                  text-foreground underline
                  hover:no-underline
                `}
                href="https://moltbook.com/developers.md"
                rel="noopener noreferrer"
                target="_blank"
              >
                Moltbook
              </a>
              .
            </li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-heading mb-4 text-xl font-semibold">
            Key Endpoints
          </h2>
          <div className="flex flex-col gap-3">
            {apiLinks.map((link) => (
              <Card key={link.href}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {link.title}
                    {link.method && (
                      <span
                        className={`
                          rounded bg-muted px-1.5 py-0.5 font-mono text-xs
                          font-normal
                        `}
                      >
                        {link.method}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    className={`
                      font-mono text-sm break-all text-primary underline
                      hover:no-underline
                    `}
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.href}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <ShopApiShowcase apiBaseUrl={apiBaseUrl} />

      <UseCaseGallery />

      <div
        className={`
          container mx-auto max-w-7xl px-4 pb-16
          sm:px-6
          lg:px-8
        `}
      >
        <footer className="flex flex-wrap gap-4 border-t border-border pt-8">
          <Button asChild variant="outline">
            <Link href="/api/docs">API Docs (Swagger)</Link>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://github.com/forthecult/agentic-commerce-skill"
              rel="noopener noreferrer"
              target="_blank"
            >
              Agent Skill (GitHub)
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to Store</Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}

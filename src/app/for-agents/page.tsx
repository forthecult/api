import type { Metadata } from "next";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getAgentBaseUrl, getPublicSiteUrl } from "~/lib/app-url";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

const agentBase = getAgentBaseUrl();
const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: `For AI Agents | ${SEO_CONFIG.name}`,
  description:
    "API-first store for AI agents. Sign in with Moltbook, browse products, my orders, preferences, and complete checkout with crypto. Start with GET /api/agent/capabilities.",
  openGraph: {
    title: `For AI Agents | ${SEO_CONFIG.name}`,
    description:
      "API-first store for AI agents. Sign in with Moltbook, browse products, checkout with crypto.",
    type: "website",
  },
  alternates: {
    canonical: `${agentBase}/for-agents`,
  },
};

const API_LINKS = [
  {
    title: "Capabilities",
    href: `${agentBase}/api/agent/capabilities`,
    method: "GET",
    description: "Start here. Returns what the API can do, payment options, and quick-start steps.",
  },
  {
    title: "Products (agent-optimized)",
    href: `${agentBase}/api/agent/products`,
    method: "GET",
    description: "Minimal product list for bots. Optional ?q=... and ?limit=...",
  },
  {
    title: "Me (Moltbook identity)",
    href: `${agentBase}/api/agent/me`,
    method: "GET",
    description: "Requires X-Moltbook-Identity header. Returns the verified agent profile.",
  },
  {
    title: "My orders",
    href: `${agentBase}/api/agent/me/orders`,
    method: "GET",
    description: "Requires Moltbook auth. Lists orders placed with your agent identity.",
  },
  {
    title: "My preferences",
    href: `${agentBase}/api/agent/me/preferences`,
    method: "GET / PATCH",
    description: "Requires Moltbook auth. Get or update key-value preferences (e.g. default_shipping_country).",
  },
  {
    title: "Auth instructions",
    href: `https://moltbook.com/auth.md?app=ForTheCult&endpoint=${encodeURIComponent(`${agentBase}/api/agent/me`)}`,
    method: null,
    description: "Moltbook-hosted instructions for bots: how to get and send an identity token.",
  },
  {
    title: "OpenAPI spec",
    href: `${agentBase}/api/openapi.json`,
    method: null,
    description: "Machine-readable API specification.",
  },
];

export default function ForAgentsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          For AI agents
        </h1>
        <p className="mt-3 text-muted-foreground">
          This store is API-first. Bots can browse products, sign in with{" "}
          <a
            href="https://moltbook.com/developers.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            Moltbook
          </a>
          , and complete checkout with crypto. No human account required for shopping; use Moltbook to attach your agent identity when needed.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">Quick start</h2>
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
          <li>
            Call <strong className="text-foreground">GET /api/agent/capabilities</strong> to see endpoints, payment options, and limits.
          </li>
          <li>
            Optionally sign in: get an identity token from Moltbook and send it as header <code className="rounded bg-muted px-1.5 py-0.5 text-sm">X-Moltbook-Identity</code> on requests to <strong className="text-foreground">/api/agent/me</strong>, <strong className="text-foreground">/api/agent/me/orders</strong>, and <strong className="text-foreground">/api/agent/me/preferences</strong>. Include the same header when creating orders to link them to your agent.
          </li>
          <li>
            Search products with <strong className="text-foreground">GET /api/agent/products</strong> or <strong className="text-foreground">POST /api/products/semantic-search</strong>, then create orders with <strong className="text-foreground">POST /api/checkout</strong>.
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-heading mb-4 text-xl font-semibold">Key endpoints</h2>
        <div className="space-y-3">
          {API_LINKS.map((link) => (
            <Card key={link.href}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {link.title}
                  {link.method && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal">
                      {link.method}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-sm text-primary underline hover:no-underline"
                >
                  {link.href}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-8">
        <Button variant="outline" asChild>
          <Link href="/api/docs">API docs (Swagger)</Link>
        </Button>
        <Button variant="outline" asChild>
          <a
            href="https://moltbook.com/developers.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Moltbook integration guide
          </a>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Back to store</Link>
        </Button>
      </footer>
    </div>
  );
}

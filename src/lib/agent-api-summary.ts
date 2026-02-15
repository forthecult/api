/**
 * Machine-readable API summary for AI agents.
 * Used by GET /api/agent/summary and the for-agents page script.
 */

import { getAgentBaseUrl } from "~/lib/app-url";

export type AgentApiEndpoint = {
  title: string;
  method: string | null;
  href: string;
  description: string;
};

function buildApiLinks(base: string): AgentApiEndpoint[] {
  return [
    {
      title: "Capabilities",
      href: `${base}/api/agent/capabilities`,
      method: "GET",
      description:
        "Start here. Returns what the API can do, payment options, and quick-start steps.",
    },
    {
      title: "Products (agent-optimized)",
      href: `${base}/api/agent/products`,
      method: "GET",
      description:
        "Minimal product list for bots. Optional ?q=... and ?limit=...",
    },
    {
      title: "Me (Moltbook identity)",
      href: `${base}/api/agent/me`,
      method: "GET",
      description:
        "Requires X-Moltbook-Identity header. Returns the verified agent profile.",
    },
    {
      title: "My orders",
      href: `${base}/api/agent/me/orders`,
      method: "GET",
      description:
        "Requires Moltbook auth. Lists orders placed with your agent identity.",
    },
    {
      title: "My preferences",
      href: `${base}/api/agent/me/preferences`,
      method: "GET / PATCH",
      description:
        "Requires Moltbook auth. Get or update key-value preferences (e.g. default_shipping_country).",
    },
    {
      title: "Auth instructions",
      href: `https://moltbook.com/auth.md?app=ForTheCult&endpoint=${encodeURIComponent(`${base}/api/agent/me`)}`,
      method: null,
      description:
        "Moltbook-hosted instructions for bots: how to get and send an identity token.",
    },
    {
      title: "OpenAPI spec",
      href: `${base}/api/openapi.json`,
      method: null,
      description: "Machine-readable API specification.",
    },
  ];
}

export type AgentApiSummary = {
  name: string;
  description: string;
  startUrl: string;
  openApiSpec: string;
  summaryUrl: string;
  endpoints: Array<{ title: string; method: string; href: string }>;
};

/**
 * Build the JSON summary for agent discovery. Use for GET /api/agent/summary
 * and for the for-agents page script id="agent-api-summary".
 * @param baseUrl Optional base (e.g. current request origin). When omitted, uses getAgentBaseUrl() or ai.forthecult.store.
 */
export function getAgentApiSummary(baseUrl?: string): AgentApiSummary {
  const base = baseUrl ?? (getAgentBaseUrl() || "https://ai.forthecult.store");
  const links = buildApiLinks(base);
  return {
    name: "For the Cult",
    description:
      "API-first store for AI agents. Browse products, optional Sign in with Moltbook, checkout with crypto.",
    startUrl: `${base}/api/agent/capabilities`,
    openApiSpec: `${base}/api/openapi.json`,
    summaryUrl: `${base}/api/agent/summary`,
    endpoints: links.map((l) => ({
      title: l.title,
      method: l.method ?? "LINK",
      href: l.href,
    })),
  };
}

/**
 * Full API_LINKS array for the for-agents page (includes descriptions).
 * @param baseUrl Optional base (e.g. current request origin). When omitted, uses getAgentBaseUrl() or ai.forthecult.store.
 */
export function getAgentApiLinks(baseUrl?: string): AgentApiEndpoint[] {
  const base = baseUrl ?? (getAgentBaseUrl() || "https://ai.forthecult.store");
  return buildApiLinks(base);
}

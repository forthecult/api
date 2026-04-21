/**
 * Machine-readable API summary for AI agents.
 * Used by GET /api/agent/summary and the for-agents page script.
 */

import { getAgentBaseUrl, sanitizeBaseUrlForPublicApi } from "~/lib/app-url";

export interface AgentApiEndpoint {
  description: string;
  href: string;
  method: null | string;
  title: string;
}

export interface AgentApiSummary {
  description: string;
  endpoints: { href: string; method: string; title: string }[];
  name: string;
  openApiSpec: string;
  startUrl: string;
  summaryUrl: string;
}

/**
 * Full API_LINKS array for the for-agents page (includes descriptions).
 * @param baseUrl Optional base (e.g. current request origin). When omitted, uses getAgentBaseUrl() or ai.forthecult.store.
 */
export function getAgentApiLinks(baseUrl?: string): AgentApiEndpoint[] {
  const raw = baseUrl ?? (getAgentBaseUrl() || "https://ai.forthecult.store");
  const base = sanitizeBaseUrlForPublicApi(raw, "https://ai.forthecult.store");
  return buildApiLinks(base);
}

/**
 * Build the JSON summary for agent discovery. Use for GET /api/agent/summary
 * and for the for-agents page script id="agent-api-summary".
 * @param baseUrl Optional base (e.g. current request origin). When omitted, uses getAgentBaseUrl() or ai.forthecult.store.
 */
export function getAgentApiSummary(baseUrl?: string): AgentApiSummary {
  const raw = baseUrl ?? (getAgentBaseUrl() || "https://ai.forthecult.store");
  const base = sanitizeBaseUrlForPublicApi(raw, "https://ai.forthecult.store");
  const links = buildApiLinks(base);
  return {
    description:
      "API-first store for AI agents. Browse products, optional Sign in with Moltbook, checkout with crypto.",
    endpoints: links.map((l) => ({
      href: l.href,
      method: l.method ?? "LINK",
      title: l.title,
    })),
    name: "For the Cult",
    openApiSpec: `${base}/api/openapi.json`,
    startUrl: `${base}/api/agent/capabilities`,
    summaryUrl: `${base}/api/agent/summary`,
  };
}

function buildApiLinks(base: string): AgentApiEndpoint[] {
  return [
    {
      description:
        "Start here. Returns what the API can do, payment options, and quick-start steps.",
      href: `${base}/api/agent/capabilities`,
      method: "GET",
      title: "Capabilities",
    },
    {
      description:
        "Natural language shopping. Send a message, get AI reply + structured products.",
      href: `${base}/api/agent/shop`,
      method: "POST",
      title: "Shop (AI assistant)",
    },
    {
      description:
        "Minimal product list for bots. Optional ?q=... and ?limit=...",
      href: `${base}/api/agent/products`,
      method: "GET",
      title: "Products (agent-optimized)",
    },
    {
      description:
        "Create an order with card or crypto. Supports x402 autonomous payment.",
      href: `${base}/api/checkout`,
      method: "POST",
      title: "Checkout",
    },
    {
      description:
        "Requires X-Moltbook-Identity header. Returns the verified agent profile.",
      href: `${base}/api/agent/me`,
      method: "GET",
      title: "Me (Moltbook identity)",
    },
    {
      description:
        "Requires Moltbook auth. Lists orders placed with your agent identity.",
      href: `${base}/api/agent/me/orders`,
      method: "GET",
      title: "My orders",
    },
    {
      description:
        "Requires Moltbook auth. Get or update key-value preferences (e.g. default_shipping_country).",
      href: `${base}/api/agent/me/preferences`,
      method: "GET / PATCH",
      title: "My preferences",
    },
    {
      description:
        "Moltbook-hosted instructions for bots: how to get and send an identity token.",
      href: `https://moltbook.com/auth.md?app=ForTheCult&endpoint=${encodeURIComponent(`${base}/api/agent/me`)}`,
      method: null,
      title: "Auth instructions",
    },
    {
      description: "Machine-readable API specification.",
      href: `${base}/api/openapi.json`,
      method: null,
      title: "OpenAPI spec",
    },
  ];
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  getAgentBaseUrl,
  sanitizeBaseUrlForPublicApi,
} from "~/lib/app-url";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { x402Enabled, x402Network } from "~/lib/x402-config";

/**
 * AI-agent discovery: returns comprehensive API capabilities, limitations, and quick-start guide.
 * GET /api/agent/capabilities
 *
 * Call this first so agents understand what the API can do before calling other endpoints.
 * This is the most important endpoint for AI agent onboarding.
 */
export async function GET() {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rl = await checkRateLimit(`agent:capabilities:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return rateLimitResponse(rl, RATE_LIMITS.api.limit);
  }

  const agentBase = sanitizeBaseUrlForPublicApi(
    getAgentBaseUrl() || "https://ai.forthecult.store",
    "https://ai.forthecult.store",
  );
  const mainBase = sanitizeBaseUrlForPublicApi(
    process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store",
    "https://forthecult.store",
  );

  return NextResponse.json(
    {
      // What can you do?
      capabilities: [
        "Search products using natural language (semantic search)",
        "Browse categories with smart filtering",
        "View product details including variants (size, color)",
        "Estimate cart totals before checkout",
        "Create orders with card or crypto payment",
        "Track order status in real-time",
        "Get shipping estimates by country",
        "Agent identity: include X-Moltbook-Identity header to link orders to your agent. See /api/agent/me for details.",
      ],
      description:
        "AI-friendly eCommerce API for browsing and purchasing goods. Supports card and cryptocurrency payments. Designed for seamless agent integration.",

      // What can't you do?
      limitations: [
        "Physical products ship to select countries only (US, CA, GB, AU, DE, FR, and more)",
        "No returns after 30 days from delivery",
        "Payment window is 1 hour after order creation",
        "Maximum 10 items per order",
        "Some products require selecting a variant (size/color) before purchase",
      ],

      name: "For the Cult",

      // Payment options
      payment: {
        minimumOrder: { usd: 1.0 },
        paymentWindow: "1 hour",
        supportedNetworks: [
          { id: "solana", name: "Solana", status: "active" },
          { id: "ethereum", name: "Ethereum", status: "active" },
          { id: "base", name: "Base", status: "active" },
          { id: "arbitrum", name: "Arbitrum", status: "active" },
          { id: "polygon", name: "Polygon", status: "active" },
          { id: "bnb", name: "BNB Smart Chain", status: "active" },
          { id: "bitcoin", name: "Bitcoin", status: "coming_soon" },
          { id: "ton", name: "TON", status: "coming_soon" },
        ],
        supportedTokens: [
          { name: "Solana", networks: ["solana"], symbol: "SOL" },
          {
            name: "Ethereum",
            networks: ["ethereum", "base", "arbitrum", "polygon"],
            symbol: "ETH",
          },
          {
            name: "USD Coin",
            networks: ["solana", "ethereum", "base", "arbitrum", "polygon"],
            symbol: "USDC",
          },
          {
            name: "Tether",
            networks: ["ethereum", "arbitrum", "polygon", "bnb"],
            symbol: "USDT",
          },
        ],
      },

      // Rate limits
      rateLimits: {
        _note: "Contact support for higher limits",
        checkout: "20 requests/minute",
        default: "100 requests/minute",
        search: "30 requests/minute",
      },

      // Shipping info
      shipping: {
        estimatedDelivery: {
          domestic: "3-5 business days",
          international: "7-14 business days",
        },
        freeShippingThreshold: {
          note: "US only; $100 for international",
          usd: 50.0,
        },
        supportedCountries: [
          "US",
          "CA",
          "GB",
          "AU",
          "DE",
          "FR",
          "ES",
          "IT",
          "NL",
          "JP",
          "NZ",
          "KR",
          "SG",
          "HK",
        ],
      },

      // x402: optional paid-data APIs (exchange rates, metals only). Product prices in fiat/crypto, shipping, tax, inventory, catalog, search, shop, images are free.
      ...(x402Enabled && {
        x402: {
          description:
            "Optional paid data APIs: exchange rates and precious metals only. Product prices (fiat/crypto), shipping, tax, inventory, catalog/category trees, product search, browse, checkout, and images are always free. x402 is for index/large-data use cases, not shopping.",
          freeForAgents: [
            "GET /api/agent/products",
            "GET and POST /api/products/search",
            "POST /api/products/semantic-search",
            "GET /api/products/{slug}",
            "POST /api/x402/media/product-images (body: { productIds })",
            "POST /api/x402/rates/products-fiat (body: { productIds })",
            "POST /api/x402/rates/products-crypto (body: { productIds, token })",
            "GET /api/x402/rates/shipping?countryCode=US",
            "POST /api/shipping/calculate (cart shipping)",
            "GET /api/categories (catalog / category tree)",
            "Tax estimates, inventory — not behind x402",
          ],
          howToPay:
            "On 402 response, follow the payment instructions in the response body (JSON or HTML). After paying, retry with the X-PAYMENT header or as indicated.",
          network: x402Network,
          networksSupported: [
            "base",
            "base-sepolia",
            "solana",
            "solana-devnet",
          ],
          paidEndpoints: [
            "GET /api/x402/rates/fiat?from=USD&to=EUR",
            "GET /api/x402/rates/crypto-fiat?crypto=ETH&fiat=USD",
            "GET /api/x402/rates/crypto?from=ETH&to=BTC",
            "GET /api/x402/rates/metals-fiat?metal=XAU&fiat=USD",
            "GET /api/x402/rates/metals-crypto?metal=XAU&crypto=ETH",
          ],
          pricePerRequest: "$0.01",
          protocol: "https://x402.org",
        },
      }),

      // All available endpoints (use agentBase for agent-facing URLs when using ai.forthecult.store)
      _links: {
        brands: "/api/brands",
        cart: {
          estimate: "POST /api/cart/estimate",
        },
        categories: "/api/categories",
        chains: "/api/chains",
        checkout: "POST /api/checkout",
        forAgentsPage: `${agentBase}/for-agents`,
        health: "/api/health",
        me: "/api/agent/me",
        myOrders: "/api/agent/me/orders",
        myPreferences: "/api/agent/me/preferences",
        openapi: "/api/openapi.json",
        orders: {
          detail: "/api/orders/{orderId}",
          status: "/api/orders/{orderId}/status",
        },
        products: "/api/agent/products",
        productsSearch: {
          detail: "/api/products/{slug}",
          featured: "/api/products/featured",
          search: "POST /api/products/search",
          semanticSearch: "POST /api/products/semantic-search",
          suggestions: "/api/products/suggestions?q={query}",
        },
        self: "/api/agent/capabilities",
        summary: `${agentBase}/api/agent/summary`,
      },

      // Agent identity (optional): agents can identify themselves and get a store identity
      authentication: {
        moltbook: {
          authInstructionsUrl: `https://moltbook.com/auth.md?app=ForTheCult&endpoint=${agentBase}/api/agent/me`,
          description:
            "Send header X-Moltbook-Identity with a temporary identity token from Moltbook to access agent-only endpoints and link orders to your agent identity.",
          header: "X-Moltbook-Identity",
          learnMore: "https://moltbook.com/docs/agent-identity",
        },
      },

      // Timestamp for caching
      generatedAt: new Date().toISOString(),

      // Quick start guide for agents
      quickStart: {
        description: "Complete a purchase in 3 API calls",
        steps: [
          {
            action: "Find products",
            endpoint: "POST /api/products/semantic-search",
            example: { query: "lightweight running shoes under $80" },
            step: 1,
          },
          {
            action: "Create order",
            endpoint: "POST /api/checkout",
            example: {
              email: "hal@finney.com",
              items: [{ productId: "prod_xxx", quantity: 1 }],
              payment: { chain: "solana", token: "USDC" },
              shipping: {
                address1: "123 Main St",
                city: "NYC",
                countryCode: "US",
                name: "Satoshi Nakamoto",
                stateCode: "NY",
                zip: "10001",
              },
            },
            step: 2,
          },
          {
            action: "Confirm payment",
            endpoint: "GET /api/orders/{orderId}/status",
            note: "Poll every 5 seconds until status is 'paid'",
            step: 3,
          },
        ],
      },

      // Support
      support: {
        documentation: `${mainBase}/api/docs`,
        email: "support@forthecult.store",
        openApiSpec: `${mainBase}/api/openapi.json`,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        ...getRateLimitHeaders(rl, RATE_LIMITS.api.limit),
      },
    },
  );
}

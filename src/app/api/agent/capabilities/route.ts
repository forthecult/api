import { NextResponse } from "next/server";

import { getAgentBaseUrl } from "~/lib/app-url";
import { x402Enabled, x402Network } from "~/lib/x402-config";

/**
 * AI-agent discovery: returns comprehensive API capabilities, limitations, and quick-start guide.
 * GET /api/agent/capabilities
 *
 * Call this first so agents understand what the API can do before calling other endpoints.
 * This is the most important endpoint for AI agent onboarding.
 */
export async function GET() {
  const agentBase = getAgentBaseUrl();
  const mainBase = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";

  return NextResponse.json(
    {
      name: "For the Cult",
      description:
        "AI-friendly eCommerce API for purchasing goods with cryptocurrency. Designed for seamless agent integration.",
      version: "1.0.0",

      // What can you do?
      capabilities: [
        "Search products using natural language (semantic search)",
        "Browse categories with smart filtering",
        "View product details including variants (size, color)",
        "Estimate cart totals before checkout",
        "Create orders with crypto payment (include X-Moltbook-Identity to link orders to your agent)",
        "Track order status in real-time",
        "Get shipping estimates by country",
        "Sign in with Moltbook: list your orders (GET /api/agent/me/orders), get/update preferences (GET/PATCH /api/agent/me/preferences)",
      ],

      // What can't you do?
      limitations: [
        "Physical products ship to select countries only (US, CA, GB, AU, DE, FR, and more)",
        "No returns after 30 days from delivery",
        "Payment window is 1 hour after order creation",
        "Maximum 10 items per order",
        "Some products require selecting a variant (size/color) before purchase",
      ],

      // Payment options
      payment: {
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
          { symbol: "SOL", name: "Solana", networks: ["solana"] },
          {
            symbol: "ETH",
            name: "Ethereum",
            networks: ["ethereum", "base", "arbitrum", "polygon"],
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            networks: ["solana", "ethereum", "base", "arbitrum", "polygon"],
          },
          {
            symbol: "USDT",
            name: "Tether",
            networks: ["ethereum", "arbitrum", "polygon", "bnb"],
          },
        ],
        paymentWindow: "1 hour",
        minimumOrder: { usd: 1.0 },
      },

      // Shipping info
      shipping: {
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
        freeShippingThreshold: {
          usd: 50.0,
          note: "US only; $100 for international",
        },
        estimatedDelivery: {
          domestic: "3-5 business days",
          international: "7-14 business days",
        },
      },

      // Rate limits
      rateLimits: {
        default: "100 requests/minute",
        search: "30 requests/minute",
        checkout: "10 requests/minute",
        _note: "Contact support for higher limits",
      },

      // x402: optional paid-data APIs (exchange rates, metals only). Product prices in fiat/crypto, shipping, tax, inventory, catalog, search, shop, images are free.
      ...(x402Enabled && {
        x402: {
          description:
            "Optional paid data APIs: exchange rates and precious metals only. Product prices (fiat/crypto), shipping, tax, inventory, catalog/category trees, product search, browse, checkout, and images are always free. x402 is for index/large-data use cases, not shopping.",
          network: x402Network,
          networksSupported: ["base", "base-sepolia", "solana", "solana-devnet"],
          pricePerRequest: "$0.01",
          paidEndpoints: [
            "GET /api/x402/rates/fiat?from=USD&to=EUR",
            "GET /api/x402/rates/crypto-fiat?crypto=ETH&fiat=USD",
            "GET /api/x402/rates/crypto?from=ETH&to=BTC",
            "GET /api/x402/rates/metals-fiat?metal=XAU&fiat=USD",
            "GET /api/x402/rates/metals-crypto?metal=XAU&crypto=ETH",
          ],
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
          protocol: "https://x402.org",
          howToPay:
            "On 402 response, follow the payment instructions in the response body (JSON or HTML). After paying, retry with the X-PAYMENT header or as indicated.",
        },
      }),

      // Sign in with Moltbook (optional): agents can identify themselves and get a store identity
      authentication: {
        moltbook: {
          description:
            "Send header X-Moltbook-Identity with a temporary identity token from Moltbook to access agent-only endpoints and link orders to your agent identity.",
          header: "X-Moltbook-Identity",
          getToken: "POST https://moltbook.com/api/v1/agents/me/identity-token (Authorization: Bearer <your_moltbook_api_key>)",
          authInstructionsUrl: `https://moltbook.com/auth.md?app=ForTheCult&endpoint=${agentBase}/api/agent/me`,
        },
      },

      // Quick start guide for agents
      quickStart: {
        description: "Complete a purchase in 3 API calls",
        steps: [
          {
            step: 1,
            action: "Find products",
            endpoint: "POST /api/products/semantic-search",
            example: { query: "wireless headphones under $100" },
          },
          {
            step: 2,
            action: "Create order",
            endpoint: "POST /api/checkout",
            example: {
              items: [{ productId: "prod_xxx", quantity: 1 }],
              email: "customer@example.com",
              payment: { chain: "solana", token: "USDC" },
              shipping: {
                name: "John Doe",
                address1: "123 Main St",
                city: "NYC",
                stateCode: "NY",
                zip: "10001",
                countryCode: "US",
              },
            },
          },
          {
            step: 3,
            action: "Confirm payment",
            endpoint: "GET /api/orders/{orderId}/status",
            note: "Poll every 5 seconds until status is 'paid'",
          },
        ],
      },

      // All available endpoints (use agentBase for agent-facing URLs when using ai.forthecult.store)
      _links: {
        self: "/api/agent/capabilities",
        me: "/api/agent/me",
        myOrders: "/api/agent/me/orders",
        myPreferences: "/api/agent/me/preferences",
        products: "/api/agent/products",
        forAgentsPage: `${agentBase}/for-agents`,
        health: "/api/health",
        openapi: "/api/openapi.json",
        categories: "/api/categories",
        productsSearch: {
          search: "POST /api/products/search",
          semanticSearch: "POST /api/products/semantic-search",
          featured: "/api/products/featured",
          suggestions: "/api/products/suggestions?q={query}",
          detail: "/api/products/{slug}",
        },
        cart: {
          estimate: "POST /api/cart/estimate",
        },
        checkout: "POST /api/checkout",
        orders: {
          status: "/api/orders/{orderId}/status",
          detail: "/api/orders/{orderId}",
        },
        chains: "/api/chains",
        brands: "/api/brands",
      },

      // Support
      support: {
        email: "support@forthecut.store",
        documentation: `${mainBase}/api/docs`,
        openApiSpec: `${mainBase}/api/openapi.json`,
      },

      // Timestamp for caching
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    },
  );
}

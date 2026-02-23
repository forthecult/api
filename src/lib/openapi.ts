/**
 * OpenAPI 3.0 spec for For the Cult API (agent discovery + checkout/orders).
 * Served at GET /api/openapi.json and used by Swagger UI at /api/docs.
 */

export const openApiSpec = {
  components: {
    responses: {
      Error400: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
        description: "Bad request",
      },
      Error404: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
        description: "Not found",
      },
    },
    schemas: {
      Error: {
        properties: {
          error: {
            properties: {
              code: { type: "string" },
              details: { type: "object" },
              message: { type: "string" },
              requestId: { type: "string" },
            },
            type: "object",
          },
        },
        type: "object",
      },
      FeaturedProduct: {
        properties: {
          badge: { type: "string" },
          category: { type: "string" },
          id: { type: "string" },
          name: { type: "string" },
          price: {
            properties: { crypto: { type: "object" }, usd: { type: "number" } },
            type: "object",
          },
        },
        type: "object",
      },
      Product: {
        properties: {
          category: { type: "string" },
          description: { type: "string" },
          id: { type: "string" },
          imageUrl: { type: "string" },
          inStock: { type: "boolean" },
          name: { type: "string" },
          price: {
            properties: {
              crypto: {
                additionalProperties: { type: "string" },
                type: "object",
              },
              usd: { type: "number" },
            },
            type: "object",
          },
          slug: { type: "string" },
        },
        type: "object",
      },
    },
  },
  info: {
    contact: { name: "For the Cult", url: "https://forthecult.store" },
    description:
      "AI-agent-friendly eCommerce API. Agents discover products, create orders, and pay with card or cryptocurrency (Solana, Ethereum, Base, and more).",
    title: "For the Cult API",
    version: "1.0.0",
  },
  openapi: "3.0.3",
  paths: {
    "/agent/capabilities": {
      get: {
        description:
          "Returns natural language description of capabilities for AI agents to understand the API's purpose and limitations.",
        operationId: "getCapabilities",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    capabilities: {
                      example: [
                        "Search and browse products",
                        "Filter by category, price, brand",
                        "Create orders with crypto payment (Solana, ETH, Base)",
                        "Track order status and shipping",
                      ],
                      items: { type: "string" },
                      type: "array",
                    },
                    limitations: {
                      example: [
                        "Products do not ship to every country",
                        "No returns 30 days after shipping",
                      ],
                      items: { type: "string" },
                      type: "array",
                    },
                    name: { example: "For the Cult", type: "string" },
                    supportedCrypto: {
                      example: [
                        "SOL",
                        "ETH",
                        "USDC",
                        "USDT",
                        "CULT",
                        "BTC",
                        "DOGE",
                        "BNB",
                        "SUI",
                        "TON",
                      ],
                      items: { type: "string" },
                      type: "array",
                    },
                    supportedNetworks: {
                      example: [
                        "solana",
                        "ethereum",
                        "base",
                        "arbitrum",
                        "bnb",
                        "polygon",
                        "bitcoin",
                        "dogecoin",
                        "monero",
                        "ton",
                      ],
                      items: { type: "string" },
                      type: "array",
                    },
                  },
                  type: "object",
                },
              },
            },
            description: "Capabilities and limitations",
          },
        },
        summary: "Describe what this API can do",
        tags: ["Health"],
      },
    },
    "/agent/summary": {
      get: {
        description:
          "JSON summary of key endpoints and start URL. Use when you prefer a single JSON response instead of parsing the for-agents HTML page.",
        operationId: "getAgentSummary",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    description: { type: "string" },
                    endpoints: {
                      items: {
                        properties: {
                          href: { type: "string" },
                          method: { type: "string" },
                          title: { type: "string" },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                    name: { type: "string" },
                    openApiSpec: { type: "string" },
                    startUrl: { type: "string" },
                    summaryUrl: { type: "string" },
                  },
                  type: "object",
                },
              },
            },
            description:
              "API summary with startUrl, openApiSpec, and endpoints list",
          },
        },
        summary: "Machine-readable API summary for agents",
        tags: ["Health"],
      },
    },
    "/brands": {
      get: {
        description: "Brands with product count and categories they appear in.",
        operationId: "getBrands",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    brands: {
                      items: {
                        properties: {
                          categories: {
                            items: { type: "string" },
                            type: "array",
                          },
                          id: { type: "string" },
                          logo: { nullable: true, type: "string" },
                          name: { type: "string" },
                          productCount: { type: "integer" },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  required: ["brands"],
                  type: "object",
                },
              },
            },
            description: "Brands",
          },
        },
        summary: "List all brands",
        tags: ["Discovery"],
      },
    },
    "/cart/estimate": {
      post: {
        description:
          "Get itemized totals, shipping estimate, and crypto amounts before checkout. No auth required.",
        operationId: "postCartEstimate",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  items: {
                    items: {
                      properties: {
                        productId: { type: "string" },
                        quantity: { type: "integer" },
                      },
                      required: ["productId", "quantity"],
                      type: "object",
                    },
                    type: "array",
                  },
                },
                required: ["items"],
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    crypto: { type: "object" },
                    expiresAt: { format: "date-time", type: "string" },
                    items: { items: { type: "object" }, type: "array" },
                    shipping: { type: "object" },
                    subtotal: { type: "object" },
                    tax: { type: "object" },
                    total: { type: "object" },
                  },
                  type: "object",
                },
              },
            },
            description:
              "Cart estimate with subtotal, shipping, tax, total, and crypto amounts",
          },
          "400": { description: "Invalid items or product not found" },
        },
        summary: "Preview cart totals",
        tags: ["Checkout"],
      },
    },
    "/categories": {
      get: {
        description:
          "Understand store structure. Returns top-level categories with subcategories and product counts.",
        operationId: "getCategories",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    categories: {
                      items: {
                        properties: {
                          description: { type: "string" },
                          id: { type: "string" },
                          name: { type: "string" },
                          productCount: { type: "integer" },
                          slug: { type: "string" },
                          subcategories: {
                            items: {
                              properties: {
                                description: { type: "string" },
                                id: { type: "string" },
                                name: { type: "string" },
                                productCount: { type: "integer" },
                              },
                              type: "object",
                            },
                            type: "array",
                          },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  required: ["categories"],
                  type: "object",
                },
              },
            },
            description: "Categories with subcategories",
          },
        },
        summary: "List all categories",
        tags: ["Discovery"],
      },
    },
    "/categories/{categoryId}": {
      get: {
        description:
          "Learn available filters (brand, price, availability) and popular products for a category.",
        operationId: "getCategoryById",
        parameters: [
          {
            in: "path",
            name: "categoryId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    availableFilters: {
                      items: { type: "object" },
                      type: "array",
                    },
                    description: { type: "string" },
                    id: { type: "string" },
                    name: { type: "string" },
                    popularProducts: {
                      items: { type: "object" },
                      type: "array",
                    },
                    priceRange: {
                      properties: {
                        currency: { type: "string" },
                        max: { type: "number" },
                        min: { type: "number" },
                      },
                      type: "object",
                    },
                    productCount: { type: "integer" },
                    subcategories: { items: { type: "object" }, type: "array" },
                  },
                  type: "object",
                },
              },
            },
            description: "Category with filters and popular products",
          },
          "404": { description: "Category not found" },
        },
        summary: "Category details with filters",
        tags: ["Discovery"],
      },
    },
    "/payment-methods": {
      get: {
        description:
          "Get all supported payment methods: enabled settings (data) and chains/tokens. Expandable to non-blockchain methods.",
        operationId: "getPaymentMethods",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    data: {
                      description: "Enabled payment method settings (display order, label, methodKey)",
                      items: { type: "object" },
                      type: "array",
                    },
                    chains: {
                      items: {
                        properties: {
                          id: { example: "solana", type: "string" },
                          name: { example: "Solana", type: "string" },
                          tokens: {
                            items: {
                              properties: {
                                decimals: { type: "integer" },
                                mint: { type: "string" },
                                name: { type: "string" },
                                symbol: { type: "string" },
                                type: {
                                  enum: ["native", "spl"],
                                  type: "string",
                                },
                              },
                              type: "object",
                            },
                            type: "array",
                          },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  required: ["data", "chains"],
                  type: "object",
                },
              },
            },
            description: "Payment method settings and supported chains/tokens",
          },
        },
        summary: "Get all supported payment methods",
        tags: ["Payment Methods"],
      },
    },
    "/chains": {
      get: {
        description:
          "Deprecated. Prefer GET /payment-methods for the canonical list. Returns chains and tokens only.",
        operationId: "getChains",
        deprecated: true,
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    chains: {
                      items: {
                        properties: {
                          id: { example: "solana", type: "string" },
                          name: { example: "Solana", type: "string" },
                          tokens: {
                            items: {
                              properties: {
                                decimals: { type: "integer" },
                                mint: { type: "string" },
                                name: { type: "string" },
                                symbol: { type: "string" },
                                type: {
                                  enum: ["native", "spl"],
                                  type: "string",
                                },
                              },
                              type: "object",
                            },
                            type: "array",
                          },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  required: ["chains"],
                  type: "object",
                },
              },
            },
            description: "Chains and tokens (deprecated, use /payment-methods)",
          },
        },
        summary: "Get chains (deprecated)",
        tags: ["Payment Methods"],
      },
    },
    "/checkout": {
      post: {
        description:
          "Create an order and get payment instructions. Supports card (Stripe), Solana, EVM chains, Bitcoin (BTCPay), and TON. Poll GET /orders/{orderId}/status until paid.",
        operationId: "postCheckout",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  email: { format: "email", type: "string" },
                  items: {
                    items: {
                      oneOf: [
                        {
                          properties: {
                            productId: { type: "string" },
                            quantity: { type: "integer" },
                          },
                          required: ["productId", "quantity"],
                          type: "object",
                        },
                        {
                          properties: {
                            asin: { type: "string" },
                            quantity: { type: "integer" },
                          },
                          required: ["asin", "quantity"],
                          type: "object",
                        },
                      ],
                    },
                    type: "array",
                  },
                  payment: {
                    properties: {
                      chain: {
                        description:
                          "Blockchain network for crypto payment. Use with token.",
                        enum: [
                          "solana",
                          "ethereum",
                          "base",
                          "arbitrum",
                          "polygon",
                          "bnb",
                        ],
                        type: "string",
                      },
                      method: {
                        description:
                          "Alternative payment method. Use instead of chain+token for card, Bitcoin, or TON.",
                        enum: ["stripe", "btcpay", "ton_pay"],
                        type: "string",
                      },
                      token: {
                        description:
                          "Token symbol. Available tokens vary by chain.",
                        enum: ["SOL", "ETH", "USDC", "USDT", "SPL"],
                        type: "string",
                      },
                      tokenMint: { nullable: true, type: "string" },
                    },
                    required: ["chain", "token"],
                    type: "object",
                  },
                  shipping: {
                    properties: {
                      address1: { type: "string" },
                      address2: { type: "string" },
                      city: { type: "string" },
                      countryCode: {
                        description: "ISO 2-letter country code",
                        type: "string",
                      },
                      name: { type: "string" },
                      phone: {
                        description:
                          "Required for accurate shipping from some fulfillment providers",
                        type: "string",
                      },
                      stateCode: {
                        description: "2-letter state code",
                        type: "string",
                      },
                      zip: { type: "string" },
                    },
                    type: "object",
                  },
                },
                required: ["items", "email", "payment"],
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    expiresAt: { format: "date-time", type: "string" },
                    orderId: { type: "string" },
                    payment: { type: "object" },
                    status: { example: "awaiting_payment", type: "string" },
                    totals: { type: "object" },
                  },
                  type: "object",
                },
              },
            },
            description: "Order and payment details",
          },
          "400": { description: "Validation or stock error" },
        },
        summary: "Create checkout order",
        tags: ["Checkout"],
      },
    },
    "/health": {
      get: {
        description:
          "Check if the API is operational. Call this first to verify connectivity before making other requests.",
        operationId: "getHealth",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    status: { example: "healthy", type: "string" },
                    timestamp: { format: "date-time", type: "string" },
                  },
                  type: "object",
                },
              },
            },
            description: "Healthy",
          },
        },
        summary: "Health check",
        tags: ["Health"],
      },
    },
    "/orders/{orderId}": {
      get: {
        description:
          "Full order details: items, shipping address, payment summary, and timeline. Access: (1) authenticated session owner or admin, or (2) valid confirmation token in query ct= for recent orders (<1h). Otherwise PII (email, shipping) is redacted. For status-only polling use GET /orders/{orderId}/status.",
        operationId: "getOrderById",
        parameters: [
          {
            in: "path",
            name: "orderId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "ct",
            required: false,
            schema: { type: "string" },
            description:
              "Confirmation token (from order confirmation email) to view full details without auth; only for orders created <1 hour ago.",
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    _actions: {
                      description: "Action hints for AI agents",
                      properties: {
                        cancel: { type: "string" },
                        help: { type: "string" },
                        next: { type: "string" },
                      },
                      type: "object",
                    },
                    createdAt: { format: "date-time", type: "string" },
                    email: { type: "string" },
                    items: { items: { type: "object" }, type: "array" },
                    orderId: { type: "string" },
                    paidAt: {
                      format: "date-time",
                      nullable: true,
                      type: "string",
                    },
                    payment: { type: "object" },
                    shipping: { type: "object" },
                    status: { type: "string" },
                    totals: { type: "object" },
                  },
                  type: "object",
                },
              },
            },
            description: "Full order",
          },
          "401": {
            description: "Not authorized (must be order owner or admin)",
          },
          "404": { description: "Order not found" },
        },
        summary: "Get order details",
        tags: ["Orders"],
      },
    },
    "/orders/{orderId}/status": {
      get: {
        description:
          "Lightweight status endpoint for polling. Returns only order status — no sensitive data. Call every 5 seconds until the order transitions from pending.",
        operationId: "getOrderStatus",
        parameters: [
          {
            in: "path",
            name: "orderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    _actions: {
                      description: "Action hints for AI agents",
                      properties: {
                        cancel: { type: "string" },
                        details: { type: "string" },
                        help: { type: "string" },
                        next: { type: "string" },
                      },
                      type: "object",
                    },
                    orderId: { type: "string" },
                    paidAt: {
                      format: "date-time",
                      nullable: true,
                      type: "string",
                    },
                    status: {
                      enum: [
                        "awaiting_payment",
                        "paid",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled",
                        "expired",
                      ],
                      type: "string",
                    },
                  },
                  type: "object",
                },
              },
            },
            description: "Order status",
          },
          "404": { description: "Order not found" },
        },
        summary: "Get order status (lightweight)",
        tags: ["Orders"],
      },
    },
    "/orders/{orderId}/cancel": {
      post: {
        description:
          "Cancel a pending order (before payment or before fulfillment). Requires: authenticated session (owner), admin, or request body with lookupValue (billing email, payment address, or shipping postal code) to prove ownership.",
        operationId: "cancelOrder",
        parameters: [
          {
            in: "path",
            name: "orderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  lookupValue: {
                    type: "string",
                    description:
                      "Optional: billing email, payer wallet address, or shipping postal code to prove ownership when not authenticated.",
                  },
                },
                type: "object",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Order cancelled",
            content: {
              "application/json": {
                schema: {
                  properties: {
                    orderId: { type: "string" },
                    status: { example: "cancelled", type: "string" },
                  },
                  type: "object",
                },
              },
            },
          },
          "400": { description: "Order already paid/shipped or invalid" },
          "401": { description: "Not authorized" },
          "404": { description: "Order not found" },
        },
        summary: "Cancel pending order",
        tags: ["Orders"],
      },
    },
    "/products/featured": {
      get: {
        description: "Featured, trending, best sellers, and deals.",
        operationId: "getFeaturedProducts",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    bestSellers: {
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                      type: "array",
                    },
                    deals: {
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                      type: "array",
                    },
                    featured: {
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                      type: "array",
                    },
                    trending: {
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                      type: "array",
                    },
                  },
                  type: "object",
                },
              },
            },
            description: "Featured, trending, bestSellers, deals",
          },
        },
        summary: "Featured / trending / deals",
        tags: ["Discovery"],
      },
    },
    "/products/search": {
      post: {
        description:
          "Search with category, subcategory, filters (brand, priceRange), and sort (newest = recently added, popular = best seller, rating = best rated). API returns only in-stock items.",
        operationId: "postProductsSearch",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  category: { type: "string" },
                  filters: {
                    properties: {
                      brand: { items: { type: "string" }, type: "array" },
                      priceRange: {
                        properties: {
                          max: { type: "number" },
                          min: { type: "number" },
                        },
                        type: "object",
                      },
                      rating: { type: "string" },
                    },
                    type: "object",
                  },
                  limit: { default: 20, type: "integer" },
                  offset: { default: 0, type: "integer" },
                  query: { type: "string" },
                  sort: {
                    enum: [
                      "price_asc",
                      "price_desc",
                      "rating",
                      "popular",
                      "newest",
                    ],
                    type: "string",
                  },
                  source: {
                    description:
                      "all = store + marketplace; store = store catalog only; marketplace = marketplace only",
                    enum: ["all", "store", "marketplace"],
                    type: "string",
                  },
                  subcategory: { type: "string" },
                },
                type: "object",
              },
            },
          },
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                    products: {
                      items: {
                        properties: {
                          category: { type: "string" },
                          description: { type: "string" },
                          id: { type: "string" },
                          imageUrl: { type: "string" },
                          inStock: { type: "boolean" },
                          name: { type: "string" },
                          price: {
                            properties: {
                              crypto: { type: "object" },
                              usd: { type: "number" },
                            },
                            type: "object",
                          },
                          productUrl: {
                            description: "Present for marketplace-sourced items",
                            type: "string",
                          },
                          slug: { type: "string" },
                          source: {
                            description: "store or marketplace",
                            enum: ["store", "marketplace"],
                            type: "string",
                          },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                    total: { type: "integer" },
                  },
                  type: "object",
                },
              },
            },
            description: "Products, total, limit, offset",
          },
        },
        summary: "Search products (with filters)",
        tags: ["Discovery", "Products"],
      },
    },
    "/products/semantic-search": {
      post: {
        description:
          "Search using natural language. E.g., 'comfortable hoodie under $60' or 'birthday gift for a friend who likes hiking'.",
        operationId: "semanticProductSearch",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  limit: { default: 10, type: "integer" },
                  query: {
                    example: "cozy winter jacket under $100",
                    type: "string",
                  },
                },
                required: ["query"],
                type: "object",
              },
            },
          },
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    _parsed: {
                      description: "Parsed query and price range used",
                      type: "object",
                    },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                    products: { items: { type: "object" }, type: "array" },
                    total: { type: "integer" },
                  },
                  type: "object",
                },
              },
            },
            description: "Products matching the natural language query",
          },
          "400": { description: "query is required" },
        },
        summary: "Natural language product search",
        tags: ["Discovery", "Products"],
      },
    },
    "/products/suggestions": {
      get: {
        description: "Keyword and product suggestions for query string.",
        operationId: "getProductSuggestions",
        parameters: [
          {
            description: "Partial query (e.g. headph)",
            in: "query",
            name: "q",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    categories: {
                      items: {
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          resultCount: { type: "integer" },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                    query: { type: "string" },
                    suggestions: {
                      items: {
                        properties: {
                          category: { type: "string" },
                          productId: { type: "string" },
                          resultCount: { type: "integer" },
                          text: { type: "string" },
                          type: {
                            enum: ["keyword", "product"],
                            type: "string",
                          },
                        },
                        type: "object",
                      },
                      type: "array",
                    },
                  },
                  type: "object",
                },
              },
            },
            description: "Suggestions and matching categories",
          },
        },
        summary: "Search suggestions (autocomplete)",
        tags: ["Discovery"],
      },
    },
    "/products/{slug}": {
      get: {
        description:
          "Single product details by slug (e.g. classic-comfort-hoodie). Returns 404 if not found or not published.",
        operationId: "getProductBySlug",
        parameters: [
          {
            description: "Product slug, e.g. classic-comfort-hoodie",
            in: "path",
            name: "slug",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
            description: "Product",
          },
          "404": { description: "Product not found" },
        },
        summary: "Get product by slug",
        tags: ["Products"],
      },
    },
    "/shipping/calculate": {
      post: {
        description:
          "Calculate shipping for a country and optional line items/address fields. No auth required.",
        operationId: "postShippingCalculate",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  city: { type: "string" },
                  countryCode: { type: "string" },
                  items: {
                    items: {
                      properties: {
                        productId: { type: "string" },
                        quantity: { type: "integer" },
                      },
                      type: "object",
                    },
                    type: "array",
                  },
                  orderValueCents: { type: "integer" },
                  stateCode: { type: "string" },
                  zip: { type: "string" },
                },
                required: ["countryCode"],
                type: "object",
              },
            },
          },
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    canShipToCountry: { type: "boolean" },
                    shippingCents: { type: "integer" },
                  },
                  type: "object",
                },
              },
            },
            description: "Shipping cost and options",
          },
        },
        summary: "Calculate shipping (with optional address)",
        tags: ["Checkout"],
      },
    },
  },
  servers: [{ description: "API base (relative)", url: "/api" }],
  tags: [
    { description: "API health", name: "Health" },
    {
      description: "Get all supported payment methods (chains and tokens)",
      name: "Payment Methods",
    },
    {
      description:
        "Agent discovery (categories, brands, featured, suggestions)",
      name: "Discovery",
    },
    { description: "Product search and details", name: "Products" },
    { description: "Create order and Solana Pay", name: "Checkout" },
    { description: "Order status and details", name: "Orders" },
  ],
} as const;

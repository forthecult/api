/**
 * OpenAPI 3.0 spec for For the Cult API (agent discovery + checkout/orders).
 * Served at GET /api/openapi.json and used by Swagger UI at /api/docs.
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "For the Cult API",
    description:
      "AI-agent-friendly eCommerce API for purchasing with cryptocurrency. Agents discover products, create orders, and pay with Solana (SOL, USDC, SPL).",
    version: "1.0.0",
    contact: { name: "For the Cult" },
  },
  servers: [{ url: "/api", description: "API base (relative)" }],
  tags: [
    { name: "Health", description: "API health" },
    { name: "Chains", description: "Payment chains and tokens" },
    {
      name: "Discovery",
      description:
        "Agent discovery (categories, brands, featured, suggestions)",
    },
    { name: "Products", description: "Product search and details" },
    { name: "Checkout", description: "Create order and Solana Pay" },
    { name: "Orders", description: "Order status and details" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description:
          "Check if the API is operational. Call this first to verify connectivity before making other requests. Returns version info and timestamp.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "healthy" },
                    version: { type: "string", example: "1.0.0" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/agent/capabilities": {
      get: {
        tags: ["Health"],
        summary: "Describe what this API can do",
        description:
          "Returns natural language description of capabilities for AI agents to understand the API's purpose and limitations.",
        operationId: "getCapabilities",
        responses: {
          "200": {
            description: "Capabilities and limitations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", example: "For the Cult" },
                    capabilities: {
                      type: "array",
                      items: { type: "string" },
                      example: [
                        "Search and browse products",
                        "Filter by category, price, brand",
                        "Create orders with crypto payment (Solana, ETH, Base)",
                        "Track order status and shipping",
                      ],
                    },
                    limitations: {
                      type: "array",
                      items: { type: "string" },
                      example: [
                        "Products do not ship to every country",
                        "No returns 30 days after shipping",
                      ],
                    },
                    supportedNetworks: {
                      type: "array",
                      items: { type: "string" },
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
                    },
                    supportedCrypto: {
                      type: "array",
                      items: { type: "string" },
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
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/chains": {
      get: {
        tags: ["Chains"],
        summary: "Supported chains and tokens",
        description: "List payment chains and tokens (e.g. SOL, USDC).",
        operationId: "getChains",
        responses: {
          "200": {
            description: "Chains and tokens",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["chains"],
                  properties: {
                    chains: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "solana" },
                          name: { type: "string", example: "Solana" },
                          tokens: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                symbol: { type: "string" },
                                name: { type: "string" },
                                type: {
                                  type: "string",
                                  enum: ["native", "spl"],
                                },
                                decimals: { type: "integer" },
                                mint: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/categories": {
      get: {
        tags: ["Discovery"],
        summary: "List all categories",
        description:
          "Understand store structure. Returns top-level categories with subcategories and product counts.",
        operationId: "getCategories",
        responses: {
          "200": {
            description: "Categories with subcategories",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["categories"],
                  properties: {
                    categories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string" },
                          slug: { type: "string" },
                          productCount: { type: "integer" },
                          subcategories: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                description: { type: "string" },
                                productCount: { type: "integer" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/categories/{categoryId}": {
      get: {
        tags: ["Discovery"],
        summary: "Category details with filters",
        description:
          "Learn available filters (brand, price, availability) and popular products for a category.",
        operationId: "getCategoryById",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Category with filters and popular products",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    productCount: { type: "integer" },
                    subcategories: { type: "array", items: { type: "object" } },
                    availableFilters: {
                      type: "array",
                      items: { type: "object" },
                    },
                    priceRange: {
                      type: "object",
                      properties: {
                        min: { type: "number" },
                        max: { type: "number" },
                        currency: { type: "string" },
                      },
                    },
                    popularProducts: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Category not found" },
        },
      },
    },
    "/brands": {
      get: {
        tags: ["Discovery"],
        summary: "List all brands",
        description: "Brands with product count and categories they appear in.",
        operationId: "getBrands",
        responses: {
          "200": {
            description: "Brands",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["brands"],
                  properties: {
                    brands: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          logo: { type: "string", nullable: true },
                          productCount: { type: "integer" },
                          categories: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/featured": {
      get: {
        tags: ["Discovery"],
        summary: "Featured / trending / deals",
        description: "Featured, trending, best sellers, and deals.",
        operationId: "getFeaturedProducts",
        responses: {
          "200": {
            description: "Featured, trending, bestSellers, deals",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    featured: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                    },
                    trending: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                    },
                    bestSellers: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                    },
                    deals: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FeaturedProduct" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/suggestions": {
      get: {
        tags: ["Discovery"],
        summary: "Search suggestions (autocomplete)",
        description: "Keyword and product suggestions for query string.",
        operationId: "getProductSuggestions",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Partial query (e.g. headph)",
          },
        ],
        responses: {
          "200": {
            description: "Suggestions and matching categories",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          type: {
                            type: "string",
                            enum: ["keyword", "product"],
                          },
                          resultCount: { type: "integer" },
                          productId: { type: "string" },
                          category: { type: "string" },
                        },
                      },
                    },
                    categories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          resultCount: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/search": {
      post: {
        tags: ["Discovery", "Products"],
        summary: "Search products (with filters)",
        description:
          "Search with category, subcategory, filters (brand, priceRange, inStock), and sort.",
        operationId: "postProductsSearch",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  category: { type: "string" },
                  subcategory: { type: "string" },
                  filters: {
                    type: "object",
                    properties: {
                      brand: { type: "array", items: { type: "string" } },
                      priceRange: {
                        type: "object",
                        properties: {
                          min: { type: "number" },
                          max: { type: "number" },
                        },
                      },
                      inStock: { type: "boolean" },
                      rating: { type: "string" },
                    },
                  },
                  sort: {
                    type: "string",
                    enum: [
                      "price_asc",
                      "price_desc",
                      "rating",
                      "popular",
                      "newest",
                    ],
                  },
                  limit: { type: "integer", default: 20 },
                  offset: { type: "integer", default: 0 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Products, total, limit, offset",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    products: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string" },
                          price: {
                            type: "object",
                            properties: {
                              usd: { type: "number" },
                              crypto: { type: "object" },
                            },
                          },
                          imageUrl: { type: "string" },
                          category: { type: "string" },
                          inStock: { type: "boolean" },
                          slug: { type: "string" },
                        },
                      },
                    },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/semantic-search": {
      post: {
        tags: ["Discovery", "Products"],
        summary: "Natural language product search",
        description:
          "Search using natural language. E.g., 'blue hoodie under $50' or 'gift for dad who likes golf'.",
        operationId: "semanticProductSearch",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    example: "cozy winter jacket under $100",
                  },
                  limit: { type: "integer", default: 10 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Products matching the natural language query",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    products: { type: "array", items: { type: "object" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                    _parsed: {
                      type: "object",
                      description: "Parsed query and price range used",
                    },
                  },
                },
              },
            },
          },
          "400": { description: "query is required" },
        },
      },
    },
    "/products/{slug}": {
      get: {
        tags: ["Products"],
        summary: "Get product by slug",
        description:
          "Single product details by slug (e.g. mens-bitcoin-hodl-tee). 404 if not found or not published.",
        operationId: "getProductBySlug",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Product slug, e.g. mens-bitcoin-hodl-tee",
          },
        ],
        responses: {
          "200": {
            description: "Product",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Product" },
              },
            },
          },
          "404": { description: "Product not found" },
        },
      },
    },
    "/checkout": {
      post: {
        tags: ["Checkout"],
        summary: "Create checkout (Solana Pay)",
        description:
          "Create an order and get Solana Pay payment instructions. Poll GET /orders/{orderId}/status until paid.",
        operationId: "postCheckout",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items", "email", "payment"],
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["productId", "quantity"],
                      properties: {
                        productId: { type: "string" },
                        quantity: { type: "integer" },
                      },
                    },
                  },
                  email: { type: "string", format: "email" },
                  payment: {
                    type: "object",
                    required: ["chain", "token"],
                    properties: {
                      chain: { type: "string", enum: ["solana"] },
                      token: { type: "string", enum: ["SOL", "USDC", "SPL"] },
                      tokenMint: { type: "string", nullable: true },
                    },
                  },
                  shipping: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      address1: { type: "string" },
                      address2: { type: "string" },
                      city: { type: "string" },
                      stateCode: {
                        type: "string",
                        description: "2-letter state code",
                      },
                      zip: { type: "string" },
                      countryCode: {
                        type: "string",
                        description: "ISO 2-letter country code",
                      },
                      phone: {
                        type: "string",
                        description: "Required for Printful shipping",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Order and payment details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    status: { type: "string", example: "awaiting_payment" },
                    expiresAt: { type: "string", format: "date-time" },
                    payment: { type: "object" },
                    totals: { type: "object" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation or stock error" },
        },
      },
    },
    "/orders/{orderId}/status": {
      get: {
        tags: ["Orders"],
        summary: "Get order status (lightweight)",
        description: "For polling. No auth; orderId is the secret.",
        operationId: "getOrderStatus",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Order status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    status: {
                      type: "string",
                      enum: [
                        "awaiting_payment",
                        "paid",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled",
                        "expired",
                      ],
                    },
                    paidAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    _actions: {
                      type: "object",
                      description: "Action hints for AI agents",
                      properties: {
                        next: { type: "string" },
                        cancel: { type: "string" },
                        details: { type: "string" },
                        help: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Order not found" },
        },
      },
    },
    "/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Get order details",
        description: "Full order: items, shipping, payment summary.",
        operationId: "getOrderById",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Full order",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orderId: { type: "string" },
                    status: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    paidAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    email: { type: "string" },
                    items: { type: "array", items: { type: "object" } },
                    shipping: { type: "object" },
                    totals: { type: "object" },
                    payment: { type: "object" },
                    _actions: {
                      type: "object",
                      description: "Action hints for AI agents",
                      properties: {
                        next: { type: "string" },
                        cancel: { type: "string" },
                        help: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Order not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          price: {
            type: "object",
            properties: {
              usd: { type: "number" },
              crypto: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
          imageUrl: { type: "string" },
          category: { type: "string" },
          inStock: { type: "boolean" },
          slug: { type: "string" },
        },
      },
      FeaturedProduct: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          price: {
            type: "object",
            properties: { usd: { type: "number" }, crypto: { type: "object" } },
          },
          badge: { type: "string" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      Error400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Error404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
} as const;

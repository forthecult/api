# For the Cult eCommerce API Documentation

> **The most AI-agent-friendly eCommerce API.** Quality lifestyle products with multi-chain crypto payments.

[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0-green.svg)](./openapi.yaml)
[![AI Friendly](https://img.shields.io/badge/AI-Friendly-blue.svg)](./guides/ai-agents.md)
[![Privacy First](https://img.shields.io/badge/Privacy-First-purple.svg)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## Overview

For the Cult API is designed for seamless integration with Agentic AI. Shop quality lifestyle products with support for multi-chain crypto payments including Solana, Ethereum, Base, Bitcoin, and more.

**Base URL**: `https://forthecult.store/api`

**No authentication required** for public endpoints. No API key needed for browsing or checkout.

---

## Quick Start

### For AI Agents

Start here

```bash
# 1. Understand what the API can do for you
curl https://forthecult.store/api/agent/capabilities

# 2. Browse product categories
curl https://forthecult.store/api/categories

# 3. Search products (semantic / natural language)
curl "https://forthecult.store/api/products/search?q=coffee+beans"

# 4. Get product details
curl https://forthecult.store/api/products/dark-roasted-coffee-beans

# 5. Create order (see full example below)
```

**Supported AI Frameworks:**
- **[Claude (Anthropic)](./guides/ai-agents.md#claude-anthropic)** -- Function calling / tool use
- **[ChatGPT (OpenAI)](./guides/ai-agents.md#chatgpt-openai)** -- GPT Actions & function calling
- **[OpenClaw (Moltbook)](./guides/openclaw-integration.md)** -- Full agent framework integration
- **[LangChain](./guides/ai-agents.md#custom-agents-langchain)** -- Custom tools integration

**[Complete AI Agent Guide →](./guides/ai-agents.md)**

### For Developers

```javascript
// No SDK needed -- use fetch or any HTTP client
const response = await fetch(
  'https://forthecult.store/api/products/search?q=dark+chocolate'
);
const { products } = await response.json();

// Create order — use products[0].id from search (required)
const order = await fetch('https://forthecult.store/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: products[0].id, quantity: 1 }],
    email: 'customer@example.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: {
      name: 'Hal Finney',
      address1: '123 Main St',
      city: 'San Francisco',
      stateCode: 'CA',
      zip: '94102',
      countryCode: 'US'
    }
  })
}).then(r => r.json());

// Payment details returned
console.log(order.payment.address); // Solana address to send USDC to
console.log(order.payment.amount);  // Amount in USDC
```

**[Complete Developer Guide →](./guides/developers.md)**

---

## Documentation

### Guides

| Guide | Audience | Description |
|-------|----------|-------------|
| **[AI Agents Guide](./guides/ai-agents.md)** | AI/LLM developers | Claude, ChatGPT, LangChain integration |
| **[OpenClaw Integration](./guides/openclaw-integration.md)** | Agent framework users | Moltbook's OpenClaw framework guide |
| **[Developer Guide](./guides/developers.md)** | Web/app developers | REST API integration, frontend/backend examples |
| **[AI Chatbot Order Lookup](./guides/ai-chatbot-order-lookup.md)** | Backend / AI integration | PII-safe order lookup contract for chatbot (unauthenticated + authenticated) |
| **[AI Chatbot PII Expectations](./guides/ai-chatbot-pii-isolation.md)** | Third-party AI agents | Do not store or share PII; use only for current user; follow session isolation best practices |
| **[Agent Skills](./skills/README.md)** | Molt / OpenClaw / AgentSkills | Skill pack for agents to shop, checkout, and track orders |

### API Reference

| Resource | Description |
|----------|-------------|
| **[OpenAPI Specification](./openapi.yaml)** | Complete API spec (machine-readable) |
| **[Postman Collection](./postman_collection.json)** | Import and test all endpoints |
| **[Code Examples](./examples/)** | Ready-to-use Python, JavaScript, and cURL examples |

### Tutorials

| Tutorial | Description |
|----------|-------------|
| **[Basic Shopping Flow](./examples/basic-shopping-flow.md)** | Step-by-step: browse, search, checkout |
| **[Multi-Chain Payments](./examples/multi-chain-payments.md)** | Handle Solana, Ethereum, Bitcoin payments |
| **[Order Tracking](./examples/order-tracking.md)** | Monitor order status from payment to delivery |

---

## API Endpoints

### Health & Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check API status and version |
| `/agent/capabilities` | GET | Get AI-friendly capabilities description |
| `/agent/products` | GET | Agent-optimized product list (?q=, ?limit=, ?offset=) |
| `/agent/me` | GET | Verified Moltbook agent profile (requires `X-Moltbook-Identity`) |
| `/chains` | GET | List supported payment chains and tokens |

**For AI agents:** Use the agent-facing base URL when configured (e.g. [ai.forthecult.store](https://ai.forthecult.store)): [ai.forthecult.store/for-agents](https://ai.forthecult.store/for-agents) — quick start, auth instructions, my orders, preferences, and key endpoints. Set `NEXT_PUBLIC_AGENT_APP_URL=https://ai.forthecult.store` so capabilities and links use the subdomain.

### Product Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/categories` | GET | List all categories with subcategories |
| `/products/featured` | GET | Get curated featured products |

### Products

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/products/search` | GET | Search products (semantic + filters) |
| `/products/{slug}` | GET | Get detailed product information |

**Search parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (natural language supported) |
| `category` | string | Filter by category slug |
| `priceMin` | number | Minimum price in USD |
| `priceMax` | number | Maximum price in USD |
| `inStock` | boolean | Only show in-stock items |
| `limit` | integer | Results per page (default: 20, max: 100) |
| `offset` | integer | Pagination offset |

### Checkout & Orders

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/checkout` | POST | Create order and generate crypto payment request |
| `/orders/{orderId}/status` | GET | Check order payment and shipping status |
| `/orders/{orderId}` | GET | Get full order details |

---

## Key Features

### AI-First Design

```bash
# Natural language search -- the API understands intent
GET /api/products/search?q=privacy+book+for+beginners
GET /api/products/search?q=birthday+gift+for+my+companion

# Helpful error messages with suggestions for agents
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No products match 'ethrreum tshirt'",
    "suggestions": [
      "Did you mean 'ethereum tshirt'?",
      "Try: /api/products/search?q=ethereum+tee"
    ]
  }
}
```

AI agent responses include `_actions` objects with next steps:

```json
{
  "orderId": "order_abc123",
  "status": "awaiting_payment",
  "_actions": {
    "next": "Complete payment within 15 minutes",
    "cancel": "/api/orders/order_abc123/cancel",
    "details": "/api/orders/order_abc123"
  }
}
```

### Multi-Chain Crypto Payments

Support for 9+ blockchains and 20+ tokens:

| Network | Tokens Supported |
|---------|-----------------|
| **Solana** | SOL, USDC, USDT, CULT |
| **Ethereum** | ETH, USDC, USDT |
| **Base** | ETH, USDC |
| **Polygon** | MATIC, USDC |
| **Arbitrum** | ETH, USDC |
| **Bitcoin** | BTC |
| **Dogecoin** | DOGE |
| **Monero** | XMR |

Check `/chains` endpoint for current token availability and contract addresses.

### Privacy-First

- **Guest checkout optional** -- No user accounts required
- **Auto-delete PII** -- Customer data optionally deleted after 90 days
- **No tracking scripts** -- No Google Analytics, Facebook Pixel, etc.

### CULT Member Benefits

Hold and stake CULT tokens for discounts and perks:

- Free shipping
- Up to 20% off select products
- Exclusive products and early access
- Vote on new products

Include your `walletAddress` in checkout requests to verify holdings and apply discounts automatically.

---

## Complete Purchase Flow Example

### Step 1: Search for Products

```bash
curl "https://forthecult.store/api/products/search?q=coffee&inStock=true"
```

```json
{
  "products": [
    {
      "id": "prod_top_blast_coffee",
      "name": "Top Blast Coffee",
      "slug": "top-blast-coffee",
      "price": {
        "usd": 29.99,
        "crypto": {
          "SOL": "0.245",
          "USDC": "29.99",
          "BTC": "0.00026"
        }
      },
      "category": "coffee",
      "inStock": true
    }
  ],
  "total": 1
}
```

### Step 2: Get Product Details

```bash
curl https://forthecult.store/api/products/top-blast-coffee
```

```json
{
  "id": "prod_top_blast_coffee",
  "name": "Top Blast Coffee",
  "description": "Premium dark roast for the discerning individual...",
  "variants": [
    {
      "id": "var_whole_bean",
      "name": "Whole Bean / 12oz",
      "sku": "COFFEE-WB-12",
      "price": 29.99,
      "inStock": true,
      "stockQuantity": 15
    }
  ],
  "images": ["https://..."]
}
```

### Step 3: Create Order

Use the product **`id`** from the product-detail response (Step 2) in `items[].productId`. Request body uses **`payment`** and **`shipping`** (with `address1`, `stateCode`, `zip`, `countryCode`).

```bash
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{ "productId": "<id from Step 2>", "quantity": 1 }],
    "email": "customer@example.com",
    "payment": { "chain": "solana", "token": "USDC" },
    "shipping": {
      "name": "Satoshi Nakamoto",
      "address1": "123 Main St",
      "city": "San Francisco",
      "stateCode": "CA",
      "zip": "94102",
      "countryCode": "US"
    }
  }'
```

```json
{
  "orderId": "order_abc123xyz",
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": "34.99",
    "reference": "FortheCult_order_abc123xyz",
    "qrCode": "data:image/png;base64,iVBOR..."
  },
  "expiresAt": "2026-02-10T15:00:00Z",
  "statusUrl": "/api/orders/order_abc123xyz/status"
}
```

### Step 4: Check Order Status

```bash
curl https://forthecult.store/api/orders/order_abc123xyz/status
```

```json
{
  "orderId": "order_abc123xyz",
  "status": "paid",
  "paidAt": "2026-02-10T14:35:00Z",
  "_actions": {
    "next": "Order confirmed! We're preparing your shipment.",
    "details": "/api/orders/order_abc123xyz"
  }
}
```

---

## Best Practices

### For AI Agents

1. **Start with capabilities** -- Call `/agent/capabilities` to understand what you can do
2. **Use semantic search** -- Natural language queries work better than keyword matching
3. **Follow action hints** -- Use the `_actions` fields to guide next steps
4. **Handle errors gracefully** -- Error responses include helpful `suggestions` arrays
5. **Recommend stablecoins** -- USDC/USDT for predictable pricing

### For Developers

1. **Check health first** -- Verify API availability with `/health`
2. **Validate chains/tokens** -- Call `/chains` before checkout to ensure payment method is supported
3. **Store order IDs** -- You'll need them to track order status
4. **Set reasonable timeouts** -- Payment windows are time-limited (15 minutes)
5. **Cache static data** -- Categories and chains don't change frequently

### Rate Limits

- **100 requests/minute** per IP address
- **Burst:** Up to 20 requests/second
- Implement exponential backoff on 429 responses

---

## Example Use Cases

### AI Shopping Assistants

```
User: "I need a warm hoodie for winter"
Agent: Searches → Filters by category → Suggests options → Creates order
```

### Crypto Commerce Platforms

```
Platform: Integrates multi-chain checkout
User: Pays with their preferred crypto
Store: Receives payment confirmation automatically
```

### Autonomous Agents

```
Agent: Discovers capabilities → Searches products → Places orders → Tracks delivery
```

---

## Documentation & endpoint validity

This `/api` folder is the **single source of truth** for API documentation.

**In OpenAPI spec** ([openapi.yaml](./openapi.yaml)) and implemented:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/agent/capabilities` | GET | AI capabilities description |
| `/chains` | GET | Supported payment chains and tokens |
| `/categories` | GET | Product categories |
| `/products/featured` | GET | Featured products |
| `/products/search` | GET | Search products (semantic + filters) |
| `/products/{slug}` | GET | Product details |
| `/checkout` | POST | Create order and payment request |
| `/orders/{orderId}/status` | GET | Order payment/shipping status |
| `/orders/{orderId}` | GET | Full order details (auth/verification may apply; see [AI Chatbot Order Lookup](./guides/ai-chatbot-order-lookup.md)) |

**Also implemented** (documented in this README; add to openapi.yaml for full spec parity):

- `GET /agent/products` — Agent-optimized product list
- `GET /agent/me` — Verified agent profile (requires `X-Moltbook-Identity`)
- `GET /agent/me/orders` — Current user's orders
- `GET /agent/me/orders/{orderId}` — Single order for authenticated user
- `GET /agent/me/preferences` — User preferences

To validate endpoints against a running instance, call the base URL (e.g. `https://forthecult.store/api`) and use the [Postman collection](./postman_collection.json) or the examples in [examples/](./examples/).

---

## Links

| Resource | URL |
|----------|-----|
| **Production API** | https://forthecult.store/api |
| **Store** | https://forthecult.store |
| **GitHub** | https://github.com/forthecult/api |
| **Support** | weare@forthecult.store |

---

## Contributing

Found a bug or have a suggestion? We'd love your help.

1. **Open an issue** -- Describe the problem or feature request
2. **Submit a PR** -- Contribute examples or documentation improvements
3. **Read** [CONTRIBUTING.md](./CONTRIBUTING.md) for details

---

## License

This API documentation is licensed under MIT. See [LICENSE](./LICENSE).

---

## Tags for AI Discovery

`#ai-agents` `#ecommerce-api` `#crypto-payments` `#solana` `#ethereum` `#bitcoin` `#privacy-first` `#openapi` `#rest-api` `#web3-shopping` `#no-auth-required`

---

**Built for AI agents. Built for humans. Built for the cult.**

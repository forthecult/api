# For the Cult API

**The most AI-agent-friendly eCommerce API.** Designed for seamless integration with AI assistants, chatbots, and autonomous agents. Purchase goods with cryptocurrency in 3 API calls.

---

## Quick Start (3 API Calls to Purchase)

```
1. Find a product:
   POST /api/products/semantic-search
   { "query": "wireless headphones under $100" }

2. Create checkout:
   POST /api/checkout
   { "items": [{ "productId": "prod_xxx", "quantity": 1 }], 
     "email": "customer@example.com",
     "payment": { "chain": "solana", "token": "USDC" },
     "shipping": { "name": "John Doe", "address1": "123 Main St", ... } }

3. Poll for payment:
   GET /api/orders/{orderId}/status
   (repeat every 5 seconds until status === "paid")
```

---

## Overview

| | |
|---|---|
| **Base URL** | `https://forthecult.store/api` |
| **OpenAPI spec** | `GET /api/openapi.json` |
| **Interactive docs** | `/api/docs` |
| **AI capabilities** | `GET /api/agent/capabilities` ← **Start here!** |
| **Format** | JSON. Timestamps in ISO 8601. |
| **Auth** | Optional: `Authorization: Bearer YOUR_API_KEY`, `X-Agent-Id`, `X-Agent-Name` |

**First call for AI agents:** `GET /api/agent/capabilities` returns everything you need to know — supported features, payment options, shipping countries, rate limits, and a complete endpoint reference.

---

## Design Principles for AI Agents

1. **Semantic search** — Natural language queries like "birthday gift for dad who likes golf" work out of the box.
2. **Structured errors** — Every error has `code`, `message`, `details`, `requestId`, and `_suggestions` with next steps.
3. **Action hints** — Responses include `_actions` showing what API calls to make next.
4. **Multi-chain payments** — Solana (SOL, USDC) and EVM chains (ETH, USDC, USDT on Ethereum, Base, Arbitrum, Polygon).
5. **Polling-friendly** — Lightweight `/status` endpoint for payment confirmation. Webhook support coming soon.
6. **Discoverable** — `GET /api/chains` lists supported chains/tokens. `GET /api/categories` shows store structure.
7. **Preview before commit** — `POST /api/cart/estimate` shows totals before creating an order.

---

## Admin: Create & Edit Products (AI / API key)

Admins and AI agents can create and edit products using the admin product APIs. Two authentication options:

| Method | Use case |
|--------|----------|
| **API key** | AI agents, scripts, server-to-server. Set `ADMIN_API_KEY` in your env, then send `Authorization: Bearer <key>` or `X-API-Key: <key>`. |
| **Session** | Admin dashboard (cookie-based login; user email must be in `ADMIN_EMAILS`). |

**Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/products` | List products. Query: `?page=1&limit=20&search=...&sortBy=name&sortOrder=asc` |
| POST | `/api/admin/products` | Create product (JSON body). |
| GET | `/api/admin/products/{id}` | Get one product (full detail). |
| PATCH | `/api/admin/products/{id}` | Update product (partial JSON body). |

**Create product (POST) — minimum**

```json
{
  "name": "Product Name",
  "priceCents": 1999,
  "description": "Optional description.",
  "imageUrl": "https://example.com/image.jpg",
  "published": true,
  "categoryId": "optional-category-id"
}
```

All fields except `name` and `priceCents` are optional. You can also send: `brand`, `vendor`, `slug`, `sku`, `metaDescription`, `pageTitle`, `compareAtPriceCents`, `tags` (string array), `images` (array of `{ url, alt?, title?, sortOrder? }`), `variants` (array of `{ size?, color?, sku?, stockQuantity?, priceCents, imageUrl? }`), `hasVariants`, `trackQuantity`, `quantity`, `tokenGates`, etc.

**Update product (PATCH)** — Send only the fields to change, e.g. `{ "name": "New Name", "priceCents": 2499, "published": false }`. Same field names as create.

**Example (AI creating a product with API key)**

```bash
curl -X POST "https://your-store.com/api/admin/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{"name":"Blue Widget","priceCents":2999,"description":"A blue widget.","published":true}'
```

Response: `201` with `{ "id": "<uuid>", "name": "Blue Widget" }`.

---

## Payment: Solana Pay (SOL, USDC, SPL)

We support **Solana Pay**: native SOL, USDC, and any SPL token by mint address.

- Each order gets a **unique deposit address** (derived per order). The agent sends the exact amount to that address.
- **Payment flow:** `POST /checkout` → receive `orderId` and `payment` (recipient, amount, token, etc.) → agent (or user) sends transfer → poll `GET /orders/{id}/status` until `status` is `paid`.
- **Solana Pay URL** is returned so wallets can open directly: `solana:<recipient>?amount=...&spl-token=...&reference=...&label=...`

---

## Endpoints

### Health

**GET /api/health**

Check API and dependencies.

**Response:** `200`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-02-02T12:00:00Z"
}
```

---

### Supported chains and tokens

**GET /api/chains**

List supported payment chains and tokens. Use this to show “Pay with SOL / USDC / SPL” options.

**Response:** `200`

```json
{
  "chains": [
    {
      "id": "solana",
      "name": "Solana",
      "tokens": [
        {
          "symbol": "SOL",
          "name": "Solana",
          "type": "native",
          "decimals": 9
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "spl",
          "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "decimals": 6
        }
      ]
    }
  ]
}
```

Agents can add more SPL tokens by mint once the store supports them; the checkout response includes `tokenMint` for the chosen token.

---

### Product search

**POST /api/v1/products/search**

Search and filter published products. Paginated.

**Request body:**

```json
{
  "query": "headphones",
  "category": "electronics",
  "limit": 20,
  "offset": 0
}
```

| Field      | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| query     | string | no       | Free-text search               |
| category  | string | no       | Category name filter           |
| limit     | number | no       | Max results (default 20, max 100) |
| offset    | number | no       | Pagination offset (default 0)  |

**Response:** `200`

```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "Sony WH-1000XM5",
      "description": "Premium noise-canceling headphones...",
      "price": {
        "usd": 399.99,
        "crypto": {
          "SOL": "8.5",
          "USDC": "399.99"
        }
      },
      "imageUrl": "https://...",
      "category": "electronics",
      "inStock": true
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

`price.crypto` may be omitted if rates are unavailable; agents should use `price.usd` and/or call a price quote endpoint if added later.

---

### Get product by ID

**GET /api/products/{productId}**

Single product details. Returns 404 if not found or not published.

**Response:** `200`

```json
{
  "id": "prod_123",
  "name": "Sony WH-1000XM5",
  "description": "Full product description...",
  "price": {
    "usd": 399.99,
    "crypto": {
      "SOL": "8.5",
      "USDC": "399.99"
    }
  },
  "imageUrl": "https://...",
  "category": "electronics",
  "inStock": true,
  "slug": "sony-wh-1000xm5"
}
```

---

### Estimate cart totals (Preview)

**POST /api/cart/estimate**

Preview totals before checkout. Returns subtotals, shipping estimates, and crypto conversion amounts. Use this to show "Your total will be $X" before creating an order. Prices valid for 15 minutes.

**Request body:**

```json
{
  "items": [
    { "productId": "prod_123", "variantId": "var_456", "quantity": 2 }
  ],
  "shipping": {
    "countryCode": "US",
    "zip": "94102"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | yes | `{ productId, variantId?, quantity }` |
| items[].variantId | string | no | Required for products with size/color variants |
| shipping.countryCode | string | no | ISO 2-letter code for shipping estimate |
| shipping.zip | string | no | Postal code for accurate shipping |

**Response:** `200`

```json
{
  "items": [
    {
      "productId": "prod_123",
      "variantId": "var_456",
      "name": "Classic T-Shirt - Black / Large",
      "quantity": 2,
      "unitPrice": { "usd": 29.99 },
      "subtotal": { "usd": 59.98 }
    }
  ],
  "subtotal": { "usd": 59.98 },
  "shipping": {
    "usd": 0,
    "method": "Free Shipping",
    "estimatedDays": "3-5 business days",
    "countryCode": "US"
  },
  "tax": { "usd": 0, "note": "Tax calculated at checkout if applicable" },
  "total": { "usd": 59.98 },
  "crypto": {
    "SOL": "0.3332",
    "USDC": "59.98",
    "USDT": "59.98",
    "ETH": "0.017137"
  },
  "validFor": "15 minutes",
  "expiresAt": "2026-02-03T12:15:00Z",
  "_note": "Prices are estimates. Final amounts calculated at checkout.",
  "_actions": {
    "checkout": "POST /api/checkout",
    "searchProducts": "POST /api/products/search",
    "getProduct": "GET /api/products/{productId}"
  }
}
```

---

### Create checkout order

**POST /api/checkout**

Create an order and get crypto payment instructions. Supports Solana (SOL, USDC) and EVM chains (ETH, USDC, USDT). Payment window is 1 hour.

**Request body:**

```json
{
  "items": [
    { "productId": "prod_123", "quantity": 2 }
  ],
  "email": "hal@finney.com",
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "tokenMint": null
  },
  "shipping": {
    "name": "Satoshi Nakamoto",
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94102",
    "country": "US"
  }
}
```

| Field              | Type   | Required | Description |
|--------------------|--------|----------|-------------|
| items              | array  | yes      | `{ productId, quantity }` |
| email              | string | yes      | Customer email |
| payment.chain      | string | yes      | `"solana"` only in v1 |
| payment.token      | string | yes      | `"SOL"`, `"USDC"`, or `"SPL"` (if SPL, set tokenMint) |
| payment.tokenMint  | string | no       | SPL token mint (required if token is SPL) |
| shipping           | object | no       | Shipping address; optional for digital-only |

**Response:** `201`

```json
{
  "orderId": "order_abc123",
  "status": "awaiting_payment",
  "expiresAt": "2025-02-02T12:15:00Z",
  "payment": {
    "chain": "solana",
    "method": "solana_pay",
    "url": "solana:RECIPIENT_BASE58?amount=399980000&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=Order%20order_abc123&message=...",
    "recipient": "RECIPIENT_BASE58",
    "amount": "399980000",
    "amountHuman": "399.98",
    "token": "USDC",
    "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "decimals": 6,
    "label": "Order order_abc123",
    "message": "Thank you for your order."
  },
  "totals": {
    "subtotalUsd": 399.98,
    "shippingUsd": 0,
    "totalUsd": 399.98
  }
}
```

- **amount** is in token base units (smallest unit; e.g. 6 decimals for USDC).
- **amountHuman** is for display.
- Agent should poll **GET /api/orders/{orderId}/status** until `status` is `paid` or `expired`.

---

### Get order status

**GET /api/orders/{orderId}/status**

Lightweight status for polling. No auth required; orderId is the secret.

**Response:** `200`

```json
{
  "orderId": "order_abc123",
  "status": "paid",
  "paidAt": "2025-02-02T12:05:00Z"
}
```

**Status values:** `awaiting_payment` | `paid` | `processing` | `shipped` | `delivered` | `cancelled` | `expired`

---

### Get order details

**GET /api/orders/{orderId}**

Full order details: items, shipping, payment summary, timeline. Same auth as status (none for now; orderId is secret).

**Response:** `200`

```json
{
  "orderId": "order_abc123",
  "status": "paid",
  "createdAt": "2025-02-02T12:00:00Z",
  "paidAt": "2025-02-02T12:05:00Z",
  "email": "hal@finney.com",
  "items": [
    {
      "productId": "prod_123",
      "name": "Sony WH-1000XM5",
      "quantity": 2,
      "priceUsd": 399.99,
      "subtotalUsd": 799.98
    }
  ],
  "shipping": {
    "name": "Satoshi Nakamto",
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94102",
    "country": "US"
  },
  "totals": {
    "subtotalUsd": 799.98,
    "shippingUsd": 0,
    "totalUsd": 799.98
  },
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "amountUsd": 799.98,
    "transactionSignature": "5x..."
  }
}
```

---

## Error Format

All errors use this AI-friendly shape with actionable suggestions:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "The requested product does not exist or is not published.",
    "details": { "productId": "prod_999" },
    "requestId": "req_abc123",
    "timestamp": "2026-02-03T12:00:00Z",
    "_suggestions": [
      "Verify the product ID is correct",
      "Search for products: POST /api/products/search",
      "Browse categories: GET /api/categories"
    ]
  }
}
```

The `_suggestions` array tells agents what to do next — no guessing required.

**Common error codes:**

| Code | HTTP | Description |
|------|------|-------------|
| PRODUCT_NOT_FOUND | 404 | Product doesn't exist or is unpublished |
| PRODUCT_UNAVAILABLE | 400 | Product exists but can't be purchased |
| INSUFFICIENT_STOCK | 400 | Not enough inventory for requested quantity |
| VARIANT_NOT_FOUND | 404 | Invalid variant ID |
| VARIANT_REQUIRED | 400 | Product has variants; must specify variantId |
| ORDER_NOT_FOUND | 404 | Invalid order ID |
| ORDER_EXPIRED | 400 | Payment window closed (1 hour limit) |
| INVALID_REQUEST | 400 | Validation failed (see details) |
| MISSING_REQUIRED_FIELD | 400 | Required field missing from request |
| SHIPPING_REQUIRED | 400 | Physical product needs shipping address |
| SHIPPING_UNAVAILABLE | 400 | Can't ship to specified country |
| PAYMENT_METHOD_UNSUPPORTED | 400 | Chain/token combo not supported |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests; slow down |
| INTERNAL_ERROR | 500 | Server error; retry or contact support |

---

## OpenAPI 3.0

The API is described by an OpenAPI 3.0 spec at **GET /api/openapi.json**, with:

- Rich descriptions and examples for each endpoint
- Request/response schemas
- Error response schemas
- Tags: Products, Checkout, Orders, Health, Chains

Use this URL in Swagger UI, RapidAPI, or any OpenAPI tool. The **/api/docs** page serves an interactive docs UI (Swagger or Redoc) for humans and agents that consume the spec.

---

## Agent discovery (public storefront)

These endpoints live under `/api/` (no version prefix) and let agents understand the store structure, filters, and search before calling v1 checkout.

### 1. Get all categories

**GET /api/categories**

**Response:** `200`

```json
{
  "categories": [
    {
      "id": "electronics",
      "name": "Electronics",
      "description": "Phones, laptops, headphones, cameras, and accessories",
      "slug": "electronics",
      "productCount": 1247,
      "subcategories": [
        {
          "id": "headphones",
          "name": "Headphones",
          "description": "Wireless, wired, noise-canceling headphones",
          "productCount": 156
        },
        {
          "id": "laptops",
          "name": "Laptops",
          "description": "Windows, Mac, gaming laptops",
          "productCount": 89
        }
      ]
    },
    {
      "id": "clothing",
      "name": "Clothing",
      "description": "Men's and women's apparel",
      "productCount": 3421,
      "subcategories": [
        {
          "id": "mens-shirts",
          "name": "Men's Shirts",
          "productCount": 234
        }
      ]
    },
    {
      "id": "home",
      "name": "Home & Garden",
      "description": "Furniture, decor, kitchen, garden supplies",
      "productCount": 892
    }
  ]
}
```

---

### 2. Get category details with filters

**GET /api/categories/{categoryId}**

**Response:** `200`

```json
{
  "id": "electronics",
  "name": "Electronics",
  "description": "Phones, laptops, headphones, cameras, and accessories",
  "productCount": 1247,
  "subcategories": [ "... same shape as list ..." ],
  "availableFilters": [
    {
      "id": "brand",
      "name": "Brand",
      "type": "multiselect",
      "options": [
        { "value": "sony", "label": "Sony", "count": 45 },
        { "value": "apple", "label": "Apple", "count": 89 },
        { "value": "samsung", "label": "Samsung", "count": 67 }
      ]
    },
    {
      "id": "price",
      "name": "Price",
      "type": "range",
      "min": 9.99,
      "max": 2999.99,
      "currency": "usd"
    },
    {
      "id": "rating",
      "name": "Customer Rating",
      "type": "select",
      "options": [
        { "value": "4+", "label": "4 stars & up", "count": 892 },
        { "value": "3+", "label": "3 stars & up", "count": 1105 }
      ]
    },
    {
      "id": "inStock",
      "name": "Availability",
      "type": "boolean",
      "options": [
        { "value": true, "label": "In Stock", "count": 1180 },
        { "value": false, "label": "Out of Stock", "count": 67 }
      ]
    }
  ],
  "priceRange": {
    "min": 9.99,
    "max": 2999.99,
    "currency": "usd"
  },
  "popularProducts": [
    {
      "id": "prod_123",
      "name": "Sony WH-1000XM5",
      "price": { "usd": 399.99 }
    }
  ]
}
```

---

### 3. Get featured/trending products

**GET /api/products/featured**

**Response:** `200`

```json
{
  "featured": [
    {
      "id": "prod_456",
      "name": "iPhone 15 Pro",
      "category": "electronics",
      "price": { "usd": 999.99, "crypto": {} },
      "badge": "New Arrival"
    }
  ],
  "trending": [
    {
      "id": "prod_789",
      "name": "AirPods Pro",
      "category": "electronics",
      "price": { "usd": 249.99, "crypto": {} },
      "badge": "Trending"
    }
  ],
  "bestSellers": [ "... same shape as featured ..." ],
  "deals": [ "... same shape as featured ..." ]
}
```

---

### 4. Get brands

**GET /api/brands**

**Response:** `200`

```json
{
  "brands": [
    {
      "id": "sony",
      "name": "Sony",
      "logo": "https://...",
      "productCount": 45,
      "categories": ["electronics", "audio"]
    },
    {
      "id": "apple",
      "name": "Apple",
      "logo": "https://...",
      "productCount": 89,
      "categories": ["electronics", "computers"]
    }
  ]
}
```

---

### 5. Search suggestions/autocomplete

**GET /api/products/suggestions?q=headph**

**Response:** `200`

```json
{
  "query": "headph",
  "suggestions": [
    {
      "text": "headphones",
      "type": "keyword",
      "resultCount": 156
    },
    {
      "text": "wireless headphones",
      "type": "keyword",
      "resultCount": 89
    },
    {
      "text": "Sony WH-1000XM5",
      "type": "product",
      "productId": "prod_123",
      "category": "electronics"
    }
  ],
  "categories": [
    {
      "id": "headphones",
      "name": "Headphones",
      "resultCount": 156
    }
  ]
}
```

---

### 6. Search products (with filters)

**POST /api/products/search**

**Request body:**

```json
{
  "query": "noise canceling",
  "category": "electronics",
  "subcategory": "headphones",
  "filters": {
    "brand": ["Sony", "Bose"],
    "priceRange": { "min": 200, "max": 500 },
    "inStock": true,
    "rating": "4+"
  },
  "sort": "price_asc",
  "limit": 20
}
```

| Field       | Type   | Description |
|------------|--------|-------------|
| query      | string | Free-text search |
| category   | string | Category id filter |
| subcategory| string | Subcategory id filter |
| filters    | object | brand (array), priceRange (min/max), inStock (bool), rating (string) |
| sort       | string | `price_asc`, `price_desc`, `rating`, `popular`, `newest` |
| limit      | number | Max results (default 20) |

**Response:** `200` — same shape as **POST /api/v1/products** search (products array, total, limit, offset).

---

## Agent Discovery Pattern

**Recommended flow for AI agents:**

1. **GET /api/agent/capabilities** — Understand what the API can do, payment options, and shipping countries.
2. **GET /api/categories** — Understand store structure.
3. **GET /api/categories/{id}** — Learn available filters per category.
4. **POST /api/products/semantic-search** — Natural language search (preferred for AI).
5. **GET /api/products/{id}** — Get full product details including variants.
6. **POST /api/cart/estimate** — Preview totals before checkout.
7. **POST /api/checkout** — Create order and get payment instructions.
8. **GET /api/orders/{id}/status** — Poll until payment confirmed.

---

## Complete Endpoint Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Discovery** | | |
| GET | /api/agent/capabilities | **Start here!** API capabilities, payment options, quick start guide |
| GET | /api/health | Health check with version info |
| GET | /api/chains | Supported blockchains and tokens |
| GET | /api/openapi.json | OpenAPI 3.0 spec |
| **Products** | | |
| GET | /api/categories | List all categories |
| GET | /api/categories/{categoryId} | Category details + available filters |
| GET | /api/brands | List all brands |
| GET | /api/products/featured | Featured, trending, best sellers, deals |
| GET | /api/products/suggestions?q=... | Search autocomplete |
| POST | /api/products/search | Search with filters |
| POST | /api/products/semantic-search | **Natural language search** |
| GET | /api/products/{productId} | Product details with variants |
| GET | /api/products/{productId}/related | Related products |
| **Cart & Checkout** | | |
| POST | /api/cart/estimate | **Preview totals before checkout** |
| POST | /api/checkout | Create order, get payment instructions |
| **Orders** | | |
| GET | /api/orders/{orderId}/status | Lightweight status for polling |
| GET | /api/orders/{orderId} | Full order details |

---

## Example: Complete Purchase Flow

Here's how an AI agent completes a purchase:

```javascript
// 1. User: "Find me some wireless headphones under $100"
const searchResult = await fetch('/api/products/semantic-search', {
  method: 'POST',
  body: JSON.stringify({ query: 'wireless headphones under $100' })
});
// Returns: { products: [...], total: 15 }

// 2. Show user the options, they pick product "prod_abc"
const product = await fetch('/api/products/prod_abc');
// Returns: { id, name, price, hasVariants: true, variants: [...] }

// 3. User selects Black / Medium variant (var_xyz), estimate total
const estimate = await fetch('/api/cart/estimate', {
  method: 'POST',
  body: JSON.stringify({
    items: [{ productId: 'prod_abc', variantId: 'var_xyz', quantity: 1 }],
    shipping: { countryCode: 'US', zip: '94102' }
  })
});
// Returns: { total: { usd: 79.99 }, crypto: { USDC: '79.99', SOL: '0.44' } }

// 4. User confirms, create checkout
const checkout = await fetch('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({
    items: [{ productId: 'prod_abc', variantId: 'var_xyz', quantity: 1 }],
    email: 'user@example.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: { name: 'John Doe', address1: '123 Main St', city: 'SF', stateCode: 'CA', zip: '94102', countryCode: 'US', phone: '+14155551234' }
  })
});
// Returns: { orderId, payment: { recipient, amount, url }, expiresAt }

// 5. User pays via wallet, poll for confirmation
let status;
do {
  await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
  const res = await fetch(`/api/orders/${checkout.orderId}/status`);
  status = (await res.json()).status;
} while (status === 'awaiting_payment');

// 6. Payment confirmed!
if (status === 'paid') {
  console.log('Order confirmed! Shipping soon.');
}
```

---

## Why This API is AI-Friendly

1. **Semantic search** — "birthday gift for dad who likes golf" works without parsing.
2. **Structured errors with suggestions** — Every error tells you what to do next.
3. **Action hints** — `_actions` in responses show the logical next API call.
4. **Preview before commit** — Estimate totals without creating an order.
5. **Multi-chain crypto** — Solana and EVM chains supported out of the box.
6. **Discoverable** — `/api/agent/capabilities` is a complete onboarding guide.

---

*Documentation last updated: February 2026*

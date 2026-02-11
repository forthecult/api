# For the Cult API

**The most AI-agent-friendly eCommerce API.** Designed for seamless integration with AI assistants, chatbots, and autonomous agents. Browse products, place orders, and pay — all through simple API calls.

---

## Quick Start (3 API Calls to Purchase)

```
1. Find a product:
   POST /api/products/semantic-search
   { "query": "lightweight running shoes under $80" }

2. Create checkout:
   POST /api/checkout
   { "items": [{ "productId": "prod_xxx", "quantity": 1 }],
     "email": "hal@finney.com",
     "payment": { "chain": "solana", "token": "USDC" },
     "shipping": { "name": "Satoshi Nakamoto", "address1": "456 Oak Ave", ... } }

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

**First call for AI agents:** `GET /api/agent/capabilities` returns everything you need to know — supported features, payment options, shipping countries, rate limits, and a complete endpoint reference.

---

## Design Principles for AI Agents

1. **Semantic search** — Natural language queries like "birthday gift for dad who likes golf" work out of the box.
2. **Structured errors** — Every error has `code`, `message`, `details`, `requestId`, and `_suggestions` with next steps.
3. **Action hints** — Responses include `_actions` showing what API calls to make next.
4. **Multiple payment methods** — Card (Stripe), Solana (SOL, USDC), EVM chains (ETH, USDC, USDT on Ethereum, Base, Arbitrum, Polygon), Bitcoin (BTCPay), and TON.
5. **Polling-friendly** — Lightweight `/status` endpoint for payment confirmation.
6. **Discoverable** — `GET /api/categories` shows store structure. `GET /api/brands` lists brands.
7. **Preview before commit** — `POST /api/cart/estimate` shows totals before creating an order.

---

## Endpoints

### Health

**GET /api/health**

Check API and dependencies.

**Response:** `200`

```json
{
  "status": "healthy",
  "timestamp": "2026-02-11T12:00:00Z"
}
```

---

### Supported Payment Methods

The store supports multiple payment methods. Use `GET /api/agent/capabilities` for the full, up-to-date list.

| Method | Networks / Tokens | Notes |
|--------|-------------------|-------|
| **Card** | Visa, Mastercard, etc. via Stripe | Redirect to Stripe checkout |
| **Solana** | SOL, USDC, SPL tokens | Deposit to unique address per order |
| **EVM** | ETH, USDC, USDT on Ethereum, Base, Arbitrum, Polygon, BNB | Deposit to unique address per order |
| **Bitcoin** | BTC via BTCPay Server | Invoice-based |
| **TON** | TON | Coming soon |

---

### Product Search

**POST /api/products/semantic-search**

Natural-language search. Ideal for AI agents — just describe what you're looking for.

**Request body:**

```json
{
  "query": "comfortable work-from-home hoodie",
  "limit": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | yes | Natural language description of what you want |
| limit | number | no | Max results (default 10) |

**Response:** `200`

```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "Classic Comfort Hoodie",
      "description": "Ultra-soft fleece hoodie, perfect for all-day wear...",
      "price": { "usd": 49.99 },
      "imageUrl": "https://...",
      "category": "hoodies",
      "inStock": true,
      "slug": "classic-comfort-hoodie"
    }
  ],
  "total": 8,
  "limit": 10,
  "offset": 0
}
```

---

**POST /api/products/search**

Structured search with filters. Use when you need precise control over results.

**Request body:**

```json
{
  "query": "hoodie",
  "category": "clothing",
  "filters": {
    "brand": ["Culture Co"],
    "priceRange": { "min": 20, "max": 80 },
    "inStock": true
  },
  "sort": "price_asc",
  "limit": 20,
  "offset": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | no | Free-text search |
| category | string | no | Category slug filter |
| subcategory | string | no | Subcategory slug filter |
| filters | object | no | brand (array), priceRange (min/max), inStock (bool), rating (string) |
| sort | string | no | `price_asc`, `price_desc`, `rating`, `popular`, `newest` |
| limit | number | no | Max results (default 20, max 100) |
| offset | number | no | Pagination offset (default 0) |

**Response:** `200` — same shape as semantic search.

---

### Get Product by Slug

**GET /api/products/{slug}**

Full product details. Returns 404 if not found or not published.

**Response:** `200`

```json
{
  "id": "prod_123",
  "name": "Classic Comfort Hoodie",
  "description": "Ultra-soft fleece hoodie, perfect for all-day wear. Available in multiple sizes and colors.",
  "price": { "usd": 49.99 },
  "imageUrl": "https://...",
  "images": [
    { "url": "https://...", "alt": "Front view" },
    { "url": "https://...", "alt": "Back view" }
  ],
  "category": "hoodies",
  "inStock": true,
  "slug": "classic-comfort-hoodie",
  "hasVariants": true,
  "variants": [
    {
      "id": "var_456",
      "size": "M",
      "color": "Black",
      "priceCents": 4999,
      "inStock": true
    }
  ]
}
```

---

### Estimate Cart Totals (Preview)

**POST /api/cart/estimate**

Preview totals before checkout. Returns subtotals, shipping estimates, and crypto conversion amounts. Prices valid for 15 minutes.

**Request body:**

```json
{
  "items": [
    { "productId": "prod_123", "variantId": "var_456", "quantity": 2 }
  ],
  "shipping": {
    "countryCode": "US",
    "zip": "10001"
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
      "name": "Classic Comfort Hoodie - Black / M",
      "quantity": 2,
      "unitPrice": { "usd": 49.99 },
      "subtotal": { "usd": 99.98 }
    }
  ],
  "subtotal": { "usd": 99.98 },
  "shipping": {
    "usd": 0,
    "method": "Free Shipping",
    "estimatedDays": "3-5 business days",
    "countryCode": "US"
  },
  "tax": { "usd": 0, "note": "Tax calculated at checkout if applicable" },
  "total": { "usd": 99.98 },
  "crypto": {
    "USDC": "99.98",
    "SOL": "0.555",
    "ETH": "0.028"
  },
  "validFor": "15 minutes",
  "expiresAt": "2026-02-11T12:15:00Z",
  "_note": "Prices are estimates. Final amounts calculated at checkout.",
  "_actions": {
    "checkout": "POST /api/checkout",
    "searchProducts": "POST /api/products/search",
    "getProduct": "GET /api/products/{slug}"
  }
}
```

---

### Create Checkout Order

**POST /api/checkout**

Create an order and get payment instructions. Supports card (Stripe) and crypto payments. Payment window is 1 hour.

**Request body (crypto payment):**

```json
{
  "items": [
    { "productId": "prod_123", "variantId": "var_456", "quantity": 2 }
  ],
  "email": "hal@finney.com",
  "payment": {
    "chain": "solana",
    "token": "USDC"
  },
  "shipping": {
    "name": "Satoshi Nakamoto",
    "line1": "456 Oak Ave",
    "line2": "Apt 3B",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "phone": "+12125551234"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | yes | `{ productId, variantId?, quantity }` |
| email | string | yes | Customer email for order confirmation |
| payment.chain | string | yes* | `"solana"`, `"ethereum"`, `"base"`, `"arbitrum"`, `"polygon"`, `"bnb"` |
| payment.token | string | yes* | `"SOL"`, `"ETH"`, `"USDC"`, `"USDT"`, or SPL token symbol |
| payment.method | string | yes* | Alternative: `"stripe"` for card, `"btcpay"` for Bitcoin, `"ton_pay"` for TON |
| shipping | object | no | Shipping address; required for physical products |

*Use either `payment.chain` + `payment.token` (crypto) or `payment.method` (card/BTC/TON).

**Response (crypto):** `201`

```json
{
  "orderId": "order_abc123",
  "status": "pending",
  "expiresAt": "2026-02-11T13:00:00Z",
  "payment": {
    "chain": "solana",
    "method": "solana_pay",
    "recipient": "<deposit-address>",
    "amount": "99980000",
    "amountHuman": "99.98",
    "token": "USDC",
    "decimals": 6,
    "label": "Order order_abc123",
    "message": "Thank you for your order."
  },
  "totals": {
    "subtotalUsd": 99.98,
    "shippingUsd": 0,
    "totalUsd": 99.98
  }
}
```

- **amount** is in token base units (smallest unit; e.g. 6 decimals for USDC).
- **amountHuman** is the display-friendly amount.
- Agent should poll **GET /api/orders/{orderId}/status** until `status` is `paid` or `expired`.

---

### Get Order Status

**GET /api/orders/{orderId}/status**

Lightweight status endpoint designed for polling. Call every 5 seconds until the order transitions from `pending`.

**Response:** `200`

```json
{
  "orderId": "order_abc123",
  "status": "paid",
  "paidAt": "2026-02-11T12:05:00Z",
  "_actions": {
    "details": "GET /api/orders/order_abc123",
    "help": "Contact support@forthecult.store"
  }
}
```

**Status values:** `pending` | `paid` | `processing` | `shipped` | `delivered` | `cancelled` | `expired`

---

### Get Order Details

**GET /api/orders/{orderId}**

Full order details including items, shipping address, payment summary, and timeline. Requires authentication (session owner or admin).

**Response:** `200`

```json
{
  "orderId": "order_abc123",
  "status": "paid",
  "createdAt": "2026-02-11T12:00:00Z",
  "paidAt": "2026-02-11T12:05:00Z",
  "items": [
    {
      "productId": "prod_123",
      "name": "Classic Comfort Hoodie - Black / M",
      "quantity": 2,
      "priceUsd": 49.99,
      "subtotalUsd": 99.98
    }
  ],
  "shipping": {
    "name": "Satoshi Nakamoto",
    "line1": "456 Oak Ave",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "totals": {
    "subtotalUsd": 99.98,
    "shippingUsd": 0,
    "totalUsd": 99.98
  }
}
```

---

## Error Format

All errors use a structured format with actionable suggestions:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "The requested product does not exist or is not published.",
    "details": { "productId": "prod_999" },
    "requestId": "req_abc123",
    "timestamp": "2026-02-11T12:00:00Z",
    "_suggestions": [
      "Verify the product ID or slug is correct",
      "Search for products: POST /api/products/semantic-search",
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
| PAYMENT_METHOD_UNSUPPORTED | 400 | Payment method not supported |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests; slow down |
| INTERNAL_ERROR | 500 | Server error; retry or contact support |

---

## OpenAPI 3.0

The full API specification is available at **GET /api/openapi.json** and includes:

- Rich descriptions and examples for each endpoint
- Request/response schemas
- Error response schemas
- Tags: Products, Checkout, Orders, Health, Discovery

Use this URL in Swagger UI, Postman, or any OpenAPI tool. The **/api/docs** page serves an interactive Swagger UI.

---

## Agent Discovery (Public Storefront)

These endpoints help agents understand the store structure before making a purchase.

### 1. Get All Categories

**GET /api/categories**

**Response:** `200`

```json
{
  "categories": [
    {
      "id": "hoodies",
      "name": "Hoodies & Sweatshirts",
      "description": "Pullover hoodies, zip-ups, and crewneck sweatshirts",
      "slug": "hoodies",
      "productCount": 42,
      "subcategories": [
        {
          "id": "pullover-hoodies",
          "name": "Pullover Hoodies",
          "productCount": 28
        },
        {
          "id": "zip-hoodies",
          "name": "Zip-Up Hoodies",
          "productCount": 14
        }
      ]
    },
    {
      "id": "tees",
      "name": "T-Shirts",
      "description": "Graphic tees, basics, and premium cotton shirts",
      "productCount": 156
    },
    {
      "id": "accessories",
      "name": "Accessories",
      "description": "Hats, bags, stickers, and more",
      "productCount": 89
    }
  ]
}
```

---

### 2. Get Category Details with Filters

**GET /api/categories/{categoryId}**

**Response:** `200`

```json
{
  "id": "tees",
  "name": "T-Shirts",
  "description": "Graphic tees, basics, and premium cotton shirts",
  "productCount": 156,
  "availableFilters": [
    {
      "id": "brand",
      "name": "Brand",
      "type": "multiselect",
      "options": [
        { "value": "culture-co", "label": "Culture Co", "count": 45 },
        { "value": "cult-basics", "label": "Cult Basics", "count": 32 }
      ]
    },
    {
      "id": "price",
      "name": "Price",
      "type": "range",
      "min": 19.99,
      "max": 79.99,
      "currency": "usd"
    },
    {
      "id": "inStock",
      "name": "Availability",
      "type": "boolean",
      "options": [
        { "value": true, "label": "In Stock", "count": 148 },
        { "value": false, "label": "Out of Stock", "count": 8 }
      ]
    }
  ],
  "priceRange": {
    "min": 19.99,
    "max": 79.99,
    "currency": "usd"
  },
  "popularProducts": [
    {
      "id": "prod_789",
      "name": "Cult Classic Tee",
      "price": { "usd": 34.99 }
    }
  ]
}
```

---

### 3. Get Featured/Trending Products

**GET /api/products/featured**

**Response:** `200`

```json
{
  "featured": [
    {
      "id": "prod_456",
      "name": "Limited Edition Hoodie",
      "category": "hoodies",
      "price": { "usd": 69.99 },
      "badge": "New Arrival"
    }
  ],
  "trending": [
    {
      "id": "prod_789",
      "name": "Cult Classic Tee",
      "category": "tees",
      "price": { "usd": 34.99 },
      "badge": "Trending"
    }
  ],
  "bestSellers": [ "..." ],
  "deals": [ "..." ]
}
```

---

### 4. Get Brands

**GET /api/brands**

**Response:** `200`

```json
{
  "brands": [
    {
      "id": "culture-co",
      "name": "Culture Co",
      "logo": "https://...",
      "productCount": 45,
      "categories": ["tees", "hoodies"]
    },
    {
      "id": "cult-basics",
      "name": "Cult Basics",
      "logo": "https://...",
      "productCount": 32,
      "categories": ["tees", "accessories"]
    }
  ]
}
```

---

### 5. Search Suggestions / Autocomplete

**GET /api/products/suggestions?q=hood**

**Response:** `200`

```json
{
  "query": "hood",
  "suggestions": [
    {
      "text": "hoodie",
      "type": "keyword",
      "resultCount": 42
    },
    {
      "text": "zip-up hoodie",
      "type": "keyword",
      "resultCount": 14
    },
    {
      "text": "Classic Comfort Hoodie",
      "type": "product",
      "productId": "prod_123",
      "category": "hoodies"
    }
  ],
  "categories": [
    {
      "id": "hoodies",
      "name": "Hoodies & Sweatshirts",
      "resultCount": 42
    }
  ]
}
```

---

## Agent Discovery Pattern

**Recommended flow for AI agents:**

1. **GET /api/agent/capabilities** — Understand what the API can do, payment options, and shipping countries.
2. **GET /api/categories** — Understand store structure.
3. **GET /api/categories/{id}** — Learn available filters per category.
4. **POST /api/products/semantic-search** — Natural language search (preferred for AI).
5. **GET /api/products/{slug}** — Get full product details including variants.
6. **POST /api/cart/estimate** — Preview totals before checkout.
7. **POST /api/checkout** — Create order and get payment instructions.
8. **GET /api/orders/{orderId}/status** — Poll until payment confirmed.

---

## Complete Endpoint Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Discovery** | | |
| GET | /api/agent/capabilities | **Start here!** API capabilities and quick-start guide |
| GET | /api/health | Health check |
| GET | /api/openapi.json | OpenAPI 3.0 spec |
| **Products** | | |
| GET | /api/categories | List all categories |
| GET | /api/categories/{categoryId} | Category details + available filters |
| GET | /api/brands | List all brands |
| GET | /api/products/featured | Featured, trending, best sellers, deals |
| GET | /api/products/suggestions?q=... | Search autocomplete |
| POST | /api/products/search | Search with filters |
| POST | /api/products/semantic-search | **Natural language search** |
| GET | /api/products/{slug} | Product details with variants |
| GET | /api/products/{slug}/related | Related products |
| **Cart & Checkout** | | |
| POST | /api/cart/estimate | **Preview totals before checkout** |
| POST | /api/shipping/calculate | Shipping estimate |
| POST | /api/checkout | Create order, get payment instructions |
| **Orders** | | |
| GET | /api/orders/{orderId}/status | Lightweight status for polling |
| GET | /api/orders/{orderId} | Full order details |
| POST | /api/orders/{orderId}/cancel | Cancel a pending order |

---

## Example: Complete Purchase Flow

Here's how an AI agent completes a purchase:

```javascript
// 1. User: "Find me a comfortable hoodie under $60"
const searchResult = await fetch('/api/products/semantic-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'comfortable hoodie under $60' })
});
const { products } = await searchResult.json();
// Returns: { products: [...], total: 8 }

// 2. User picks a product — get full details
const product = await (await fetch(`/api/products/${products[0].slug}`)).json();
// Returns: { id, name, price, hasVariants: true, variants: [...] }

// 3. User selects Black / Medium variant, estimate the total
const estimate = await fetch('/api/cart/estimate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: product.id, variantId: 'var_xyz', quantity: 1 }],
    shipping: { countryCode: 'US', zip: '10001' }
  })
});
const totals = await estimate.json();
// Returns: { total: { usd: 49.99 }, shipping: { usd: 0 }, ... }

// 4. User confirms — create the order
const order = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: product.id, variantId: 'var_xyz', quantity: 1 }],
    email: 'hal@finney.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: {
      name: 'Satoshi Nakamoto',
      address1: '456 Oak Ave',
      city: 'New York',
      stateCode: 'NY',
      zip: '10001',
      countryCode: 'US',
      phone: '+12125551234'
    }
  })
});
const { orderId, payment } = await order.json();
// Returns: { orderId, payment: { recipient, amount, amountHuman }, expiresAt }

// 5. Customer pays, then poll for confirmation
let status;
do {
  await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
  const res = await fetch(`/api/orders/${orderId}/status`);
  status = (await res.json()).status;
} while (status === 'pending');

// 6. Done!
if (status === 'paid') {
  console.log('Order confirmed! Your items will ship soon.');
}
```

---

## Why This API is AI-Friendly

1. **Semantic search** — "birthday gift for a friend who likes hiking" works without any query parsing.
2. **Structured errors with suggestions** — Every error tells the agent what to do next.
3. **Action hints** — `_actions` in responses show the logical next API call.
4. **Preview before commit** — Estimate totals without creating an order.
5. **Multiple payment options** — Card, Solana, Ethereum, Base, Bitcoin, and more.
6. **Discoverable** — `/api/agent/capabilities` is a complete onboarding guide.

---

*Documentation last updated: February 2026*

# AI Customer API Review: Making Culture Store the Best AI eCommerce API

**Reviewer:** AI Customer Perspective  
**Date:** February 2026  
**Goal:** Perfect these APIs so they are the most intuitive, reliable, and delightful eCommerce APIs any AI has ever used.

---

## Executive Summary

The Culture Store API is **well-designed** with strong foundations for AI-agent use. The `/api/agent/capabilities` endpoint, semantic search, and `_actions` hints are excellent AI-first features. However, several improvements would make this truly world-class.

**Current Grade: B+**  
**Target Grade: A+**

### Top 5 Issues to Fix

1. **Inconsistent error formats** — Some endpoints return `{ error: "string" }`, others `{ error: { code, message } }`
2. **Checkout only supports Solana/USDC** — Documentation promises broader support
3. **Missing product variants in checkout** — Can't specify size/color
4. **No cart persistence** — Agents must rebuild cart each session
5. **Missing shipping estimation before checkout** — Agents can't show total cost upfront

---

## Detailed Review

### 1. Discovery & Onboarding

#### ✅ What's Great

- **`GET /api/agent/capabilities`** — Brilliant! This tells me exactly what I can do. Every API should have this.
- **`GET /api/health`** — Simple, effective health check with version info.
- **`GET /api/chains`** — Discoverable payment options without hardcoding.

#### 🔧 Recommendations

**1.1 Add rate limit info to capabilities**

```json
{
  "rateLimits": {
    "default": "100 requests/minute",
    "search": "30 requests/minute",
    "checkout": "10 requests/minute"
  }
}
```

**1.2 Add `GET /api/agent/context` for session-aware info**

```json
{
  "currentTime": "2026-02-03T12:00:00Z",
  "currency": "USD",
  "shippingCountries": ["US", "CA", "GB", "AU", "DE", ...],
  "storeHours": "24/7 online",
  "supportContact": "support@culturestore.com",
  "estimatedShippingDays": {
    "US": "3-5 business days",
    "international": "7-14 business days"
  }
}
```

**1.3 Add `_links` to capabilities for HATEOAS-style discovery**

```json
{
  "_links": {
    "categories": "/api/categories",
    "search": "/api/products/search",
    "featured": "/api/products/featured",
    "checkout": "/api/checkout",
    "openapi": "/api/openapi.json"
  }
}
```

---

### 2. Product Discovery

#### ✅ What's Great

- **Semantic search** — `POST /api/products/semantic-search` is exceptional. "cozy winter jacket under $100" just works.
- **Category filters** — `availableFilters` with counts per option is perfect for building UIs.
- **Suggestions** — Autocomplete returns both keywords and products.

#### 🔧 Recommendations

**2.1 Add `stockQuantity` to product responses**

Currently only `inStock: boolean`. Agents need to know:
- Can I order 5 of these?
- Is it low stock (urgency signal)?

```json
{
  "inStock": true,
  "stockQuantity": 23,
  "stockStatus": "in_stock" | "low_stock" | "out_of_stock" | "backorder"
}
```

**2.2 Add product variants to search results**

For clothing/sized items, agents need to know available sizes before product detail page:

```json
{
  "id": "prod_123",
  "name": "Classic T-Shirt",
  "hasVariants": true,
  "variantSummary": {
    "colors": ["Black", "White", "Navy"],
    "sizes": ["S", "M", "L", "XL"],
    "priceRange": { "min": 29.99, "max": 34.99 }
  }
}
```

**2.3 Add `GET /api/products/{productId}/availability`**

Quick check for specific variant availability without full product fetch:

```json
GET /api/products/prod_123/availability?variant=var_456

{
  "productId": "prod_123",
  "variantId": "var_456",
  "inStock": true,
  "stockQuantity": 15,
  "estimatedShipDate": "2026-02-05"
}
```

**2.4 Improve search relevance signals**

Add `relevanceScore` and `matchedFields` so agents understand why products matched:

```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "Sony WH-1000XM5",
      "_relevance": {
        "score": 0.95,
        "matchedFields": ["name", "description"],
        "highlights": {
          "description": "Premium <em>noise-canceling</em> headphones..."
        }
      }
    }
  ]
}
```

---

### 3. Product Details

#### ✅ What's Great

- Consistent `price.usd` and `price.crypto` structure
- Variants with `optionDefinitions` for building selection UIs
- `availableCountryCodes` for shipping eligibility

#### 🔧 Recommendations

**3.1 Add structured specifications**

```json
{
  "specifications": [
    { "name": "Battery Life", "value": "30 hours", "unit": "hours" },
    { "name": "Weight", "value": "250", "unit": "g" },
    { "name": "Driver Size", "value": "40", "unit": "mm" }
  ]
}
```

**3.2 Add `shippingInfo` preview**

```json
{
  "shippingInfo": {
    "weight": "0.5 kg",
    "dimensions": "20x15x8 cm",
    "shipsFrom": "US",
    "freeShippingThreshold": 50.00,
    "estimatedDelivery": {
      "US": "3-5 business days",
      "international": "7-14 business days"
    }
  }
}
```

**3.3 Add `relatedProducts` inline (optional)**

Some agents want related products without a second call:

```json
GET /api/products/prod_123?include=related

{
  ...product,
  "related": [
    { "id": "prod_456", "name": "...", "reason": "frequently_bought_together" },
    { "id": "prod_789", "name": "...", "reason": "same_category" }
  ]
}
```

---

### 4. Cart & Checkout

#### ❌ Critical Issues

**4.1 No cart persistence**

Agents building multi-step flows lose context. Need:

```
POST /api/cart          — Create cart, get cartId
GET /api/cart/{cartId}  — Retrieve cart
PUT /api/cart/{cartId}  — Update cart
DELETE /api/cart/{cartId}/items/{itemId}
POST /api/cart/{cartId}/checkout — Convert to order
```

**4.2 Checkout doesn't accept variants**

Current: `{ "productId": "prod_123", "quantity": 2 }`

Needed: `{ "productId": "prod_123", "variantId": "var_456", "quantity": 2 }`

**4.3 No shipping cost preview**

Agents can't show "Your total will be $X" before checkout creation.

#### 🔧 Recommendations

**4.4 Add `POST /api/cart/estimate`**

Preview totals before committing:

```json
POST /api/cart/estimate
{
  "items": [{ "productId": "prod_123", "variantId": "var_456", "quantity": 2 }],
  "shipping": { "countryCode": "US", "zip": "94102" },
  "paymentMethod": "crypto"
}

Response:
{
  "items": [...],
  "subtotal": { "usd": 79.98 },
  "shipping": { "usd": 5.99, "method": "Standard", "estimatedDays": "3-5" },
  "tax": { "usd": 0 },
  "total": { "usd": 85.97 },
  "crypto": {
    "SOL": "1.82",
    "USDC": "85.97",
    "ETH": "0.034"
  },
  "expiresAt": "2026-02-03T12:15:00Z",
  "_note": "Prices valid for 15 minutes"
}
```

**4.5 Support all documented payment methods**

Current implementation only supports Solana/USDC. Add:
- ETH (Ethereum, Base, Arbitrum, Polygon)
- BTC, DOGE, BNB, SUI, TON as documented

**4.6 Add coupon/discount support**

```json
POST /api/checkout
{
  "items": [...],
  "couponCode": "WELCOME10",
  ...
}

Response includes:
{
  "totals": {
    "subtotalUsd": 79.98,
    "discountUsd": 7.99,
    "discountCode": "WELCOME10",
    "discountDescription": "10% off first order",
    "totalUsd": 71.99
  }
}
```

---

### 5. Orders & Status

#### ✅ What's Great

- `_actions` hints are perfect for agents
- Lightweight `/status` endpoint for polling
- Clear status enum

#### 🔧 Recommendations

**5.1 Add webhook support for agents**

Instead of polling, let agents register callbacks:

```json
POST /api/orders/{orderId}/webhooks
{
  "url": "https://agent.example.com/callbacks/order-status",
  "events": ["paid", "shipped", "delivered"],
  "secret": "whsec_..."
}
```

**5.2 Add tracking info to status**

```json
{
  "orderId": "order_abc123",
  "status": "shipped",
  "tracking": {
    "carrier": "USPS",
    "trackingNumber": "9400111899223456789012",
    "trackingUrl": "https://tools.usps.com/go/TrackConfirmAction?tLabels=...",
    "estimatedDelivery": "2026-02-07"
  }
}
```

**5.3 Add `GET /api/orders/{orderId}/timeline`**

Full order history for debugging:

```json
{
  "orderId": "order_abc123",
  "timeline": [
    { "event": "created", "timestamp": "2026-02-03T12:00:00Z" },
    { "event": "payment_received", "timestamp": "2026-02-03T12:05:00Z", "txHash": "..." },
    { "event": "processing", "timestamp": "2026-02-03T12:10:00Z" },
    { "event": "shipped", "timestamp": "2026-02-04T09:00:00Z", "carrier": "USPS" },
    { "event": "delivered", "timestamp": "2026-02-07T14:30:00Z" }
  ]
}
```

---

### 6. Error Handling

#### ❌ Critical Issue: Inconsistent Error Formats

Some endpoints return:
```json
{ "error": "Product not found" }
```

Others return:
```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "Product not found" } }
```

#### 🔧 Standardize All Errors

Every error response should follow this format:

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "The requested product does not exist or is not published.",
    "details": {
      "productId": "prod_999"
    },
    "requestId": "req_abc123",
    "timestamp": "2026-02-03T12:00:00Z",
    "_suggestions": [
      "Check the product ID is correct",
      "Search for similar products: POST /api/products/search"
    ]
  }
}
```

**Add `_suggestions` for actionable next steps** — This is AI-friendly!

---

### 7. AI-Specific Enhancements

#### 🔧 Recommendations

**7.1 Add `POST /api/agent/recommend`**

AI-to-AI endpoint for personalized recommendations:

```json
POST /api/agent/recommend
{
  "context": "User is looking for a birthday gift for their mother who likes gardening",
  "budget": { "min": 30, "max": 100 },
  "previousPurchases": ["prod_abc", "prod_def"]
}

Response:
{
  "recommendations": [
    {
      "product": { ...product },
      "reason": "Highly rated gardening gloves, perfect for gardening enthusiasts",
      "confidence": 0.92
    }
  ]
}
```

**7.2 Add `GET /api/products/{productId}/qa`**

Pre-answered questions for product:

```json
{
  "productId": "prod_123",
  "questions": [
    {
      "question": "Is this compatible with iPhone?",
      "answer": "Yes, compatible with all Bluetooth-enabled devices including iPhone.",
      "source": "product_description"
    },
    {
      "question": "What's the warranty?",
      "answer": "2-year manufacturer warranty.",
      "source": "specifications"
    }
  ]
}
```

**7.3 Add conversation context endpoint**

```json
POST /api/agent/context
{
  "conversationId": "conv_123",
  "viewedProducts": ["prod_abc", "prod_def"],
  "cartItems": ["prod_ghi"],
  "preferences": {
    "priceRange": { "max": 200 },
    "categories": ["electronics"]
  }
}

Response:
{
  "contextId": "ctx_456",
  "expiresAt": "2026-02-03T13:00:00Z",
  "summary": "User interested in electronics under $200, viewed headphones and speakers"
}
```

---

### 8. Documentation Improvements

#### 🔧 Recommendations

**8.1 Add "Quick Start for AI Agents" section**

```markdown
## Quick Start (3 API calls to purchase)

1. Find a product:
   POST /api/products/semantic-search
   { "query": "wireless headphones under $100" }

2. Create checkout:
   POST /api/checkout
   { "items": [{ "productId": "prod_123", "quantity": 1 }], ... }

3. Poll for payment confirmation:
   GET /api/orders/{orderId}/status
   (repeat until status === "paid")
```

**8.2 Add example conversations**

Show how an AI agent would use the API in a real conversation:

```
User: "I need headphones for working from home"
Agent: POST /api/products/semantic-search { "query": "headphones for working from home" }
       → Found 3 options: Sony WH-1000XM5 ($399), Jabra Evolve2 ($249), ...
Agent: "I found 3 great options. The Sony WH-1000XM5 has the best noise canceling..."
```

**8.3 Add idempotency guidance**

Document idempotency keys for POST endpoints:

```
POST /api/checkout
Headers:
  Idempotency-Key: "order-user123-20260203-001"
```

---

### 9. Security & Trust

#### 🔧 Recommendations

**9.1 Add request signing for agents**

```
Headers:
  X-Agent-Id: agent_123
  X-Agent-Signature: sha256=...
  X-Timestamp: 2026-02-03T12:00:00Z
```

**9.2 Add `GET /api/trust/verify`**

Verify store legitimacy for cautious agents:

```json
{
  "verified": true,
  "businessName": "Culture Store Inc.",
  "verifiedBy": "Stripe",
  "since": "2024-01-01",
  "totalOrders": 15000,
  "averageRating": 4.8,
  "returnPolicy": "30-day returns on most items"
}
```

---

## Priority Action Items

### P0 (Critical — Fix Now)

1. **Standardize error format** across all endpoints
2. **Add variantId support** to checkout
3. **Add shipping cost estimation** before checkout

### P1 (High — This Sprint)

4. Add cart persistence endpoints
5. Support all documented payment methods (ETH, BTC, etc.)
6. Add tracking info to order status
7. Add `stockQuantity` to products

### P2 (Medium — Next Sprint)

8. Add `POST /api/cart/estimate`
9. Add `_suggestions` to error responses
10. Add webhook support for order status
11. Add order timeline endpoint

### P3 (Nice to Have)

12. Add `/api/agent/recommend`
13. Add `/api/products/{id}/qa`
14. Add conversation context endpoint
15. Add request signing

---

## Conclusion

The Culture Store API has excellent foundations for AI agents. The semantic search, capabilities endpoint, and `_actions` hints show clear AI-first thinking. 

With the improvements outlined above — especially consistent errors, variant support, and shipping estimation — this would genuinely be the best AI eCommerce API available.

**Current state:** Good API with some friction points  
**After improvements:** World-class AI-native eCommerce API

---

*Review completed by AI Customer Perspective. All recommendations based on real-world agent interaction patterns and common integration challenges.*

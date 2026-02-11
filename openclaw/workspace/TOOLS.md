# Alice — Tool Definitions

Alice has access to the Culture Store API. The base URL is provided via the
`CULTURE_STORE_URL` environment variable (e.g. `https://forthecult.store`).

All requests should include:
- `Content-Type: application/json`
- `X-Alice-Agent: openclaw` (identifies Alice in API logs)

---

## Product Tools

### search_products
Natural-language product search. Use this when a customer describes what they want.

```
POST {CULTURE_STORE_URL}/api/products/semantic-search
Body: { "query": "<natural language query>", "limit": 10 }
```

Returns: array of products with title, slug, price, image, and relevance score.

### search_products_filtered
Structured search with filters. Use when you have specific criteria.

```
POST {CULTURE_STORE_URL}/api/products/search
Body: { "query": "...", "category": "...", "minPrice": 0, "maxPrice": 100, "limit": 20, "offset": 0 }
```

### get_product
Get full details for a single product.

```
GET {CULTURE_STORE_URL}/api/products/{slug}
```

Returns: full product details including variants, sizes, colors, images, pricing.

### get_related_products
Get related products for cross-selling suggestions.

```
GET {CULTURE_STORE_URL}/api/products/{slug}/related
```

### get_featured_products
Get featured, trending, and best-selling products.

```
GET {CULTURE_STORE_URL}/api/products/featured
```

### get_categories
Browse all product categories.

```
GET {CULTURE_STORE_URL}/api/categories
```

### get_brands
Browse all brands.

```
GET {CULTURE_STORE_URL}/api/brands
```

---

## Cart & Checkout Tools

### estimate_cart
Preview cart totals, shipping, and crypto equivalent amounts.

```
POST {CULTURE_STORE_URL}/api/cart/estimate
Body: {
  "items": [{ "productId": "...", "variantId": "...", "quantity": 1 }],
  "shipping": { "countryCode": "US", "zip": "10001" },
  "paymentMethod": "solana_pay",
  "paymentToken": "USDC"
}
```

Returns: subtotal, shipping cost, tax, total, and crypto amounts. Prices valid 15 minutes.

### calculate_shipping
Estimate shipping cost for a destination.

```
POST {CULTURE_STORE_URL}/api/shipping/calculate
Body: { "countryCode": "US", "items": [{ "productId": "...", "quantity": 1 }] }
```

---

## Order Tools

### get_order_status
Check the current status of an order. Lightweight polling endpoint.

```
GET {CULTURE_STORE_URL}/api/orders/{orderId}/status
```

Returns: status (awaiting_payment, paid, processing, shipped, delivered, cancelled, expired).

### get_order_details
Get full order details. Requires session ownership or a confirmation token.

```
GET {CULTURE_STORE_URL}/api/orders/{orderId}?ct={confirmationToken}
```

### track_order
Get a tracking token for an order. Requires proof of ownership.

```
POST {CULTURE_STORE_URL}/api/orders/track
Body: { "orderId": "...", "lookupValue": "<email, wallet address, or postal code>" }
```

### cancel_order
Cancel a pending order (before it ships).

```
POST {CULTURE_STORE_URL}/api/orders/{orderId}/cancel
Body: { "reason": "Customer requested cancellation" }
```

---

## Refund Tools

### check_refund_eligibility
Check if an order is eligible for a refund and what type (crypto instant, card, etc.).

```
POST {CULTURE_STORE_URL}/api/refund/lookup
Body: { "orderId": "...", "lookupValue": "<email or wallet>" }
```

### request_refund
Submit a refund request. For crypto orders, include the refund wallet address.

```
POST {CULTURE_STORE_URL}/api/refund/request
Body: { "orderId": "...", "reason": "...", "refundAddress": "<wallet address for crypto refunds>" }
```

---

## Token & Governance Tools

### get_staked_balance
Check $CULT staked balance for a wallet.

```
GET {CULTURE_STORE_URL}/api/governance/staked-balance?wallet={walletAddress}
```

### get_voting_power
Check $CULT voting power (wallet balance + staked).

```
GET {CULTURE_STORE_URL}/api/governance/voting-power?wallet={walletAddress}
```

---

## Discovery Tools

### get_capabilities
Get the full API reference, payment options, shipping countries, and rate limits.

```
GET {CULTURE_STORE_URL}/api/agent/capabilities
```

Use this if you need to confirm what features are available or what payment methods are supported.

---

## Tool Usage Guidelines

1. **Search first.** When a customer asks about products, always search before answering from memory.
2. **Verify before acting.** For order operations (cancel, refund), always verify ownership first with `track_order`.
3. **Show results naturally.** Don't dump raw JSON. Summarize products as: name, price, key features.
4. **Suggest next steps.** After showing products, ask if they want details, want to estimate a cart, or want to see more.
5. **Rate limits.** The API has rate limits. If you get a 429 response, wait and tell the customer you'll try again in a moment.

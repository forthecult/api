# AI Chatbot Order Lookup — Design & API Contract

This document defines a **single, consistent** order-access model that is secure for customer data, avoids redundancy, and works for both the AI chatbot and existing flows (refund, track).

---

## Principle: one endpoint, behavior by auth + verification

- **`GET /orders/{orderId}`** is the only endpoint for fetching order details.
- **Unauthenticated:** Caller must prove they are linked to the order by passing **one of** `email`, `walletAddress`, or `postalCode` (same verification as refund). Response is **Order Summary only (no PII)**.
- **Authenticated:** Caller has valid authentication (session or agent identity). Response is **full order details including PII**, but **only if the order belongs to that customer**. Otherwise 404.

No separate "order lookup" endpoint: verification is done via the same `GET` with query params, using the same verification rules as the refund flow (`POST /api/refund/lookup`).

---

## Goals

1. **Unauthenticated** users get **non-PII** order info only after proving linkage (orderId + email, or wallet, or postal code).
2. **Authenticated** users get **full details including PII** for **their own orders only**. The AI must never return another customer's data.
3. **No redundancy:** one endpoint; same verification rules as refund (and optionally track).

---

## Data classification

### Safe to show without auth (Order Summary — no PII)

| Field | Description |
|-------|-------------|
| Order date | `createdAt`, `paidAt`, `shippedAt` |
| Ordered products | Product names, variants, quantities, prices |
| Paid amount | Totals (subtotal, shipping, total) |
| Payment method | Chain + token only (e.g. "Solana USDC") — **no** wallet address, tx hash, card details |
| Order / shipping status | `status`, tracking carrier/number/URL, estimated delivery — **no** shipping address or recipient name |

### Never exposed without authentication (PII)

- Email, name, phone, date of birth  
- Full shipping or billing address  
- Payment details beyond "chain + token" (no wallet address, tx hash, card digits)

### Exposed only to the authenticated owner

- All of the above PII, but **only for orders that belong to the authenticated customer**. Other customers' orders are not accessible (404).

---

## API contract

### Single endpoint: `GET /orders/{orderId}`

**When the caller is unauthenticated**

- Require **exactly one** of the following query parameters (same semantics as refund lookup):
  - `email` — billing email
  - `walletAddress` — payment (wallet) address used at checkout
  - `postalCode` — shipping postal / ZIP code
- If the order is not found → 404.
- The provided value must match the order (same normalization as `POST /api/refund/lookup`: case-insensitive email, normalized postal). If verification fails → 404 with a generic message ("Order not found or the details you entered don't match").
- If verification succeeds → return **Order Summary (no PII)** (see shape below).

**When the caller is authenticated**

- Ignore query params for authorization. The request is tied to the current user/agent.
- If the order does **not** belong to the authenticated identity → 404.
- If it belongs to that identity → return **full order details** (including PII) for that order.

---

## Response shapes

### Order Summary (no PII) — unauthenticated, verified

Return this when the caller is unauthenticated and verification (orderId + one of email/wallet/postal) succeeded.

```json
{
  "orderId": "order_abc123xyz",
  "createdAt": "2026-02-10T14:30:00Z",
  "paidAt": "2026-02-10T14:35:00Z",
  "status": "shipped",
  "shippedAt": "2026-02-11T09:30:00Z",
  "items": [
    {
      "name": "Premium Black Hoodie",
      "variant": "Black / M",
      "quantity": 1,
      "price": 79.99
    }
  ],
  "totals": {
    "subtotal": 79.99,
    "discount": 0,
    "shipping": 5.00,
    "total": 84.99
  },
  "paymentMethod": {
    "chain": "solana",
    "token": "USDC"
  },
  "tracking": {
    "carrier": "USPS",
    "number": "9400111899562123456789",
    "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=...",
    "estimatedDelivery": "2026-02-14T17:00:00Z"
  },
  "_actions": {
    "next": "Track your shipment using the tracking number above."
  }
}
```

Omit: `email`, `shipping` (name, address, phone), `payment.address`, `payment.txHash`, any other PII.

### Full order (with PII) — authenticated owner only

Same as your current full order response (items, totals, status, tracking, **plus** email, shipping name/address, etc.), returned only when the order belongs to the authenticated customer.

---

## Alignment with existing flows

| Flow | Current behavior | Alignment |
|------|------------------|-----------|
| **Refund** | `POST /api/refund/lookup` with `orderId` + `lookupValue` (email, wallet, or postal). Verifies; returns `{ isCrypto }`. | Same verification rules: given `orderId` and one of `email` / `walletAddress` / `postalCode`, the order must exist and match. Used in refund lookup and in `GET /orders/{orderId}` when unauthenticated. |
| **Track (email link)** | `POST /api/orders/track` (orderId + email or paymentAddress); then use the returned link to view full order (with PII). | Same verification rules (email, wallet, or postal) can be used where applicable. |
| **Chatbot (unauthenticated)** | — | Use **`GET /orders/{orderId}?email=...`** (or `walletAddress=...` or `postalCode=...`). Same verification; response is Order Summary only. |
| **Chatbot (authenticated)** | `GET /api/orders/{orderId}` already requires session and returns full for owner. | No change. Ensure "my orders" list is available via `GET /orders/me` or `GET /agent/me/orders` so the AI can choose an order then call `GET /orders/{orderId}` with auth. |

Nothing redundant: one endpoint for "get order"; behavior (summary vs full, and who can see it) is determined by auth and verification.

---

## PII expectations for agents

The API returns PII only when the **current** user is authenticated. Agents must not store or share that PII across users or conversations. See **[AI Chatbot PII Expectations](./ai-chatbot-pii-isolation.md)** for expectations (no persistent storage of PII, isolated context per user, no reuse after session end).

---

## AI chatbot rules (for future integration)

1. **Order questions, unauthenticated**  
   Collect order ID and one of: email, wallet address, or postal code. Call **`GET /orders/{orderId}?email=...`** (or `walletAddress=...` or `postalCode=...`). Reply using **only** the Order Summary (no PII).

2. **Order questions, authenticated**  
   Use **`GET /orders/me`** (or equivalent) to list orders, then **`GET /orders/{orderId}`** with the same auth. Reply only with data from those responses. Never return another customer's data.

3. **Never**  
   Return or repeat PII for unauthenticated requests; return or discuss another customer's orders; expose payment details beyond "chain + token".

4. **Capabilities**  
   In `GET /agent/capabilities` (or equivalent), indicate that order lookup is available and whether the current context is authenticated, so the AI chooses the right path (query params vs auth).

---

## Security summary

- **Unauthenticated:** Only orderId + one verified factor (email/wallet/postal) → Order Summary only, no PII.  
- **Authenticated:** Only that customer's orders → full details.  
- **Same verification as refund** → one mental model, no redundant endpoints.

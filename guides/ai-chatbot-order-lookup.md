# AI Chatbot Order Lookup — Design & API Contract

This document defines a **single, consistent** order-access model that is secure for customer data, avoids redundancy, and works for both the AI chatbot and existing flows (refund, track).

---

## Principle: one endpoint, behavior by auth + verification

- **`GET /orders/{orderId}`** is the only endpoint for fetching order details.
- **Unauthenticated:** Caller must prove they are linked to the order by passing **one of** `email`, `walletAddress`, or `postalCode` (same verification as refund). Response is **Order Summary only (no PII)**. *Note: Unauthenticated lookup by email/wallet/postalCode is the target design; current implementation may use session or confirmation token (`ct`) for non-admin access.*
- **Authenticated:** Caller has a valid session (or agent identity). Response is **full order details including PII**, but **only if the order belongs to that customer**. Otherwise 404.

No separate "order lookup" endpoint: verification is done via the same `GET` with query params, and the backend can **reuse the same verification logic** already used by the refund flow (`POST /api/refund/lookup`).

---

## Goals

1. **Unauthenticated** users get **non-PII** order info only after proving linkage (orderId + email, or wallet, or postal code).
2. **Authenticated** users get **full details including PII** for **their own orders only**. The AI must never return another customer's data.
3. **No redundancy:** one endpoint; verification logic shared with refund (and optionally track).

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

- All of the above PII, but **only for orders that belong to the authenticated customer**. The backend must scope by `userId` / `email` (or agent id) and return 404 for other customers' orders.

---

## API contract

### Single endpoint: `GET /orders/{orderId}`

**When the caller is unauthenticated**

- Require **exactly one** of the following query parameters (same semantics as refund lookup):
  - `email` — billing email
  - `walletAddress` — payment (wallet) address used at checkout
  - `postalCode` — shipping postal / ZIP code
- Backend: load order by `orderId`; if not found → 404.
- Backend: verify that the provided value matches the order's `email`, `payerWalletAddress`, or `shippingZip` (same normalization as `POST /api/refund/lookup`: case-insensitive email, normalized postal).
- If verification fails → 404 with a generic message ("Order not found or the details you entered don't match").
- If verification succeeds → return **Order Summary (no PII)** (see shape below).

**When the caller is authenticated** (session or agent identity)

- Ignore query params for authorization. Resolve the current user/agent.
- If the order's `userId` / `email` (or linked agent id) does **not** match the authenticated identity → 404.
- If it matches → return **full order details** (including PII) for that order.

**Admin** (if applicable) can continue to get full details for any order via existing admin auth.

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
| **Refund** | `POST /api/refund/lookup` with `orderId` + `lookupValue` (email, wallet, or postal). Verifies; returns `{ isCrypto }`. | Keep as-is. Backend should use a **shared verification helper**: given `orderId` and one of `email` / `walletAddress` / `postalCode`, return whether the order exists and matches. Use this in refund lookup and in `GET /orders/{orderId}` when unauthenticated. |
| **Track (email link)** | `POST /api/orders/track` (orderId + email or paymentAddress) → token. `GET /api/orders/{orderId}/track?t=token` → full order (with PII). | Optional: add `postalCode` to `POST /api/orders/track` so verification matches refund (email, wallet, or postal). Token-based track can keep returning full PII for "magic link" use. |
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

## Backend implementation checklist

- [ ] **Shared verification helper**  
  `verifyOrderByProof(orderId, { email?, walletAddress?, postalCode? })`: same logic as `POST /api/refund/lookup` (normalize email, wallet, postal; match against order). Use in refund lookup and in `GET /orders/{orderId}`.
- [ ] **`GET /orders/{orderId}`**  
  - If unauthenticated: require one of `email`, `walletAddress`, `postalCode`. Call shared helper; on success return Order Summary (no PII); on failure → 404.  
  - If authenticated: resolve user/agent; if order belongs to them return full order; else 404.
- [ ] **Optional:** Add `postalCode` to `POST /api/orders/track` so verification is identical to refund (email, wallet, or postal).
- [ ] **Optional:** If you prefer the chatbot not to send email in the URL, support **POST** to the same resource (e.g. body `{ orderId, email }` or `{ orderId, walletAddress }` or `{ orderId, postalCode }`) that returns Order Summary when verification succeeds. Either way, same verification logic and same response shape.
- [ ] Document in OpenAPI/skill: `GET /orders/{orderId}` with optional query params and the two response shapes (summary vs full) by auth.

---

## Security summary

- **Unauthenticated:** Only orderId + one verified factor (email/wallet/postal) → Order Summary only, no PII.  
- **Authenticated:** Only that customer's orders → full details.  
- **Same verification as refund** → one mental model, one shared implementation, no redundant endpoints.

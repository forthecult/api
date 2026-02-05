# API Security Review: Customer-Facing and Admin APIs

**Date:** February 5, 2026  
**Scope:** All API routes under `/api` (customer-facing and admin).

---

## Executive Summary

| Area | Status | Critical fixes |
|------|--------|----------------|
| Customer-facing APIs | Reviewed | Order cancel: design note; contact/loqate: rate limit recommended |
| Admin APIs | Reviewed | **6 admin routes were missing auth — fixed** |
| Webhooks | Reviewed | Printify: set secret in prod; Stripe/Printful/BTCPay verified |
| IDOR / ownership | Reviewed | Owner checks present where required |

---

## 1. Customer-Facing APIs

### 1.1 Authentication and authorization

- **Protected by session (require auth):**
  - `/api/user/*` (profile, avatar, notifications) — scoped to `session.user.id`
  - `/api/orders/[orderId]` GET — **owner or admin** (userId or email match, or getAdminAuth)
  - `/api/support-tickets/*` — **owner only** (ticket userId = session.user.id)
  - `/api/support-chat/conversations*` — **owner only** (userId or guestId header)
  - `/api/dashboard/counts` — session required, counts by userId
  - `/api/wishlist/*` — session required, wishlist by userId
  - `/api/affiliates/apply`, `/api/affiliates/me` — session required, scoped to userId
  - `/api/media/*` — session required; DELETE checks `uploadsTable.userId === session.user.id`
  - Checkout create-order routes (solana-pay, btcpay, eth-pay, ton-pay) — optional session (guest checkout allowed); body validated

- **Public by design (no auth):**
  - `/api/health`, `/api/agent/capabilities`, `/api/openapi.json` — metadata only
  - `/api/products/*`, `/api/categories/*`, `/api/brands`, `/api/cart/estimate`, `/api/shipping/estimate`, `/api/shipping/calculate` (optional session for saved address)
  - `/api/token-gate/challenge`, `/api/token-gate/validate`, `/api/token-gate` GET — token gating flow
  - `/api/checkout/coupons/validate` — optional session
  - `/api/affiliates/validate` — public validation of affiliate code

### 1.2 Order-related endpoints (no auth: orderId as secret)

- **GET /api/orders/[orderId]/status** — No auth. Returns status, paidAt, expiresAt; no PII. **Design:** orderId (CUID) is the secret for polling after checkout. Acceptable.
- **GET /api/checkout/orders/[orderId]** — No auth. Returns payment info (deposit address, email, totalCents, etc.) for **pending** orders only. **Design:** needed for crypto checkout page; orderId is the secret. Acceptable; order IDs are unguessable (CUID).
- **POST /api/orders/[orderId]/cancel** — **No auth.** Anyone with the orderId can cancel a pending order.
  - **Risk:** If orderId is leaked (referrer, logs, or shared link), a third party could cancel the order. CUIDs are not guessable.
  - **Recommendation:** Optional hardening: require either (1) session owning the order, or (2) a short-lived cancel token issued when order is created and passed in body. Not changed in this review; document as accepted risk.

### 1.3 Input validation and abuse

- **POST /api/contact** — Body validated (name, email, subject, message); 10 KB limit. **No rate limiting** — can be used for spam. **Recommendation:** Add rate limit by IP (e.g. 5/min).
- **GET /api/loqate/find**, **/api/loqate/retrieve** — Proxy to Loqate; API key server-side. **No auth or rate limit** — anyone can consume quota. **Recommendation:** Rate limit by IP; optionally require session or origin check.
- Checkout and payment confirm routes use **rate limiting** (`RATE_LIMITS.checkout`) and/or body validation (Zod where present).

### 1.4 IDOR and resource scope

- **Support tickets:** `supportTicketTable.userId === session.user.id` in WHERE. No IDOR.
- **Support chat:** Conversations and messages scoped by `userId` or `guestId` (header). Owner check on GET conversation by id. No IDOR.
- **Orders GET:** Owner = session user id or email match; else admin. No IDOR.
- **Media DELETE:** Explicit `mediaItem.userId !== session.user.id` → 403. No IDOR.
- **Wishlist, dashboard counts, affiliates:** All filtered by `session.user.id`. No IDOR.

---

## 2. Admin APIs

### 2.1 Authentication patterns

- **getAdminAuth(request):** Used where admin API may be called with **API key** (e.g. agents) or **session.**  
  Routes: products (GET/POST), support-chat (conversations, messages, widget-visible), support-tickets (list, by id, messages), notification-templates, pod/* (products, bulk, catalog, upload).
- **Session + isAdminUser(session.user):** Used for all other admin routes. Admin list comes from **ADMIN_EMAILS** (server-only env).

### 2.2 Critical fix: Admin routes that had no auth

The following admin routes **did not check authentication** and were fixed in this review:

| Route | Method | Fix |
|-------|--------|-----|
| `/api/admin/printful/status` | GET | Added session + isAdminUser |
| `/api/admin/printify/status` | GET | Added session + isAdminUser |
| `/api/admin/printful/sync` | POST, GET | Added session + isAdminUser |
| `/api/admin/printify/sync` | POST, GET | Added session + isAdminUser |
| `/api/admin/printful/products` | GET | Added session + isAdminUser |
| `/api/admin/printify/products` | GET | Added session + isAdminUser |

**Impact before fix:** Unauthenticated users could check Printful/Printify config, trigger sync (import/export), and list products. Now all require admin session.

### 2.3 Other admin routes

- All other admin routes under `/api/admin/*` either use **getAdminAuth** or **session + isAdminUser**. No further gaps found.
- **Admin API key:** When `ADMIN_API_KEY` is set, `getAdminAuth` accepts `Authorization: Bearer <key>` or `X-API-Key: <key>` with **constant-time comparison** (timing-safe).

---

## 3. Webhooks

| Webhook | Signature / secret | Status |
|---------|--------------------|--------|
| **Stripe** `/api/payments/stripe/webhook` | `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` | ✅ Verified |
| **Printful** `/api/webhooks/printful` | HMAC-SHA256 with `PRINTFUL_WEBHOOK_SECRET` (hex); rejects if missing/invalid | ✅ Verified when secret set |
| **BTCPay** `/api/webhooks/btcpay` | HMAC-SHA256 of raw body with `BTCPAY_WEBHOOK_SECRET`; timing-safe compare | ✅ Verified when secret set |
| **Printify** `/api/webhooks/printify` | Optional `secret` query param vs `PRINTIFY_WEBHOOK_SECRET`; if secret not set, **no verification** | ⚠️ Set `PRINTIFY_WEBHOOK_SECRET` and use it in webhook URL in production |

---

## 4. Summary of Recommendations

### Done in this review

- Added **admin auth** to: `admin/printful/status`, `admin/printify/status`, `admin/printful/sync` (POST+GET), `admin/printify/sync` (POST+GET), `admin/printful/products`, `admin/printify/products`.

### Recommended next steps

1. **Contact form:** Add rate limiting (e.g. by IP, 5 requests/minute).
2. **Loqate:** Add rate limiting and optionally restrict to same-origin or session.
3. **Order cancel:** If you want to harden, require session ownership or a cancel token; otherwise keep “orderId as secret” and avoid leaking order IDs.
4. **Printify webhook:** Ensure `PRINTIFY_WEBHOOK_SECRET` is set and the webhook URL includes it (or equivalent) in production.
5. **Rate limiting:** In-memory store is used; for multi-instance production, use a shared store (e.g. Redis) for rate limits.

### Not changed (by design)

- **Orders status and checkout/orders/[orderId]:** Public with orderId as secret; CUID makes enumeration impractical.
- **Agent capabilities, openapi, health:** Intentionally public for discovery and monitoring.

---

## 5. Quick reference: Auth by route prefix

| Prefix | Auth | Notes |
|--------|------|--------|
| `/api/admin/*` | Admin (session or API key) | All routes now protected |
| `/api/user/*` | Session | Owner only |
| `/api/orders/[orderId]` GET | Owner or admin | Full order details |
| `/api/orders/[orderId]/status` | None | OrderId as secret |
| `/api/orders/[orderId]/cancel` | None | OrderId as secret |
| `/api/checkout/orders/[orderId]` | None | Pending payment info only |
| `/api/support-tickets/*` | Session | Owner only |
| `/api/support-chat/*` | Session or guest header | Owner only |
| `/api/wishlist/*`, `/api/dashboard/*` | Session | Owner only |
| `/api/webhooks/*` | Signature / secret | See table above |

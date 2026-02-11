<!-- INTERNAL — DO NOT PUBLISH. This document contains sensitive security architecture details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->

# Security Audit: API, Customer, AI, and Admin Authentication

**Audit date:** 2026-02-11  
**Scope:** API route protection, customer authentication, AI (Moltbook) authentication, admin authentication, customer data access, secrets exposure, and front-end/API attack vectors.

---

## Executive summary

- **Customer data:** Order and user data are scoped to the authenticated owner or admin. Refund/order lookup and order track use proof-of-ownership (email, payment address, or postal code) with no PII leakage on failure.
- **Admin:** All `/api/admin/*` routes require `getAdminAuth()` (session or API key). API key comparison is timing-safe.
- **AI (Moltbook):** Agent endpoints require a valid `X-Moltbook-Identity` token verified with Moltbook; agent data is scoped by `moltbookAgentId`.
- **Fix applied:** `POST /api/orders/{orderId}/cancel` was previously unauthenticated (anyone with orderId could cancel). It now requires session owner, admin, or body `lookupValue` (same proof as refund lookup).
- **Recommendations:** Set `PRINTIFY_WEBHOOK_SECRET` and `PRINTFUL_WEBHOOK_SECRET` in production (independent of each other). Set `ORDER_TRACK_SECRET` (or auth secret) in production. Optional Redis rate limiting: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for cross-instance limits; order status 120/min and admin 200/min per IP when enabled.

---

## 1. Authentication layers

| Layer | Mechanism | Where used |
|-------|-----------|------------|
| **Customer** | better-auth session (cookie) | `/api/user/*`, `/api/orders/[orderId]` (full details), `/api/dashboard/*`, `/api/support-tickets/*`, `/api/wishlist/*`, `/api/media/*`, `/api/stats` |
| **Admin** | Session (user in `ADMIN_EMAILS`) or API key (`ADMIN_API_KEY` / `ADMIN_AI_API_KEY`) via `Authorization: Bearer` or `X-API-Key` | All `/api/admin/*` routes |
| **AI (Moltbook)** | `X-Moltbook-Identity` header; token verified with Moltbook API using `MOLTBOOK_APP_KEY` | `/api/agent/me`, `/api/agent/me/orders`, `/api/agent/me/orders/[orderId]`, `/api/agent/me/preferences` |
| **Webhooks** | Stripe: `stripe-signature` (HMAC). Printful: `x-pf-webhook-signature` (HMAC-SHA256). Printify: optional `?secret=` query. BTCPay: `BTCPAY_WEBHOOK_SECRET`. Boxo: `Authorization` with client_id:secret (base64). | `/api/webhooks/*`, `/api/boxo/payments/status` |

---

## 2. API route protection

### 2.1 Admin routes

- **Finding:** All audited admin route handlers call `getAdminAuth(request)` and return 401 when `!authResult?.ok`.
- **Admin auth implementation:** Accepts Bearer or X-API-Key; compares to `ADMIN_AI_API_KEY` then `ADMIN_API_KEY` using `crypto.timingSafeEqual`. Session fallback requires user email in `ADMIN_EMAILS`.
- **Status:** No unprotected admin endpoints found.

### 2.2 Customer / user routes

- **Orders (full details):** `GET /api/orders/[orderId]` requires admin or session owner (userId or verified email match). Returns 401 if not owner.
- **Order status (polling):** `GET /api/orders/[orderId]/status` is intentionally unauthenticated; returns only `orderId`, `status`, `paidAt`, `expiresAt`, `txHash`, `_actions`. No PII. OrderId is a CUID (unguessable).
- **Order cancel:** `POST /api/orders/[orderId]/cancel` — **fixed.** Now requires: admin, session owner, or body `{ lookupValue }` (billing email, payment address, or shipping postal code) matching the order.
- **Order track:** `GET /api/orders/[orderId]/track?t=token` requires a valid HMAC token (from `POST /api/orders/track` after proving email/address). Token is short-lived (1 hour).
- **Refund lookup:** `POST /api/refund/lookup` returns only `{ isCrypto }` after verifying orderId + lookupValue (email, address, or postal). Same 404 for “order not found” and “no match” to avoid enumeration.
- **Refund request:** Same verification as lookup; then creates refund request and optionally notifies support. Rate-limited.
- **Support tickets:** `GET/PATCH/POST` on `/api/support-tickets/*` require session; tickets are filtered by `userId`.
- **User profile / avatar / notifications:** All require session; data scoped by `session.user.id`.
- **Dashboard counts:** Requires session; counts scoped by `userId`.
- **Stats:** Requires session; returns store-wide aggregates (order count, sales). Page is expected to be token-gated elsewhere.

### 2.3 AI (Moltbook) routes

- **Agent identity:** `getMoltbookAgentFromRequest()` validates token with Moltbook; returns 401/403/404 on invalid or expired token.
- **Agent orders:** `GET /api/agent/me/orders` and `GET /api/agent/me/orders/[orderId]` filter by `moltbookAgentId === agent.id`. No cross-agent data leakage.

### 2.4 Public / unauthenticated routes

- **Checkout:** `POST /api/checkout` is public; rate-limited. Creates order with customer-provided email/shipping; no privilege escalation.
- **Orders by-session:** `GET /api/orders/by-session?session_id=...` uses Stripe checkout session ID (long random string) to return one order summary. Acceptable if Stripe session IDs are not guessable; consider short TTL or one-time use if needed.
- **Order track token:** `POST /api/orders/track` returns a token only after proving email or payment address for the order. Token creation uses `ORDER_TRACK_SECRET` or `AUTH_SECRET`; ensure one is set in production (avoid default fallback in prod).

---

## 3. Secrets and sensitive data

- **Admin API keys:** Not logged or returned in responses. Comparison is timing-safe.
- **Moltbook:** `MOLTBOOK_APP_KEY` used only server-side for verification; not exposed to client.
- **Order track secret:** `ORDER_TRACK_SECRET` (or `NEXTAUTH_SECRET`) used in HMAC. Default `"order-track-fallback"` when unset is weak — **recommendation:** set `ORDER_TRACK_SECRET` or `AUTH_SECRET` in production.
- **Loqate:** API key used only in server-side fetch to Loqate; never sent to client.
- **Webhooks:** Stripe/Printful verify signatures. Printify: if `PRINTIFY_WEBHOOK_SECRET` is set, query param `secret` is required; **recommendation:** always set in production to prevent forged webhook calls.

---

## 4. Customer data and IDOR

- **Orders:** Full order details (including PII) only via session owner, admin, or order-track token. Status-only endpoint exposes no PII.
- **Refund / cancel:** Proof of ownership via email, payment address, or postal code; no enumeration (same 404 for not-found and no-match).
- **Support tickets:** Queried with `eq(supportTicketTable.userId, session.user.id)`.
- **User profile:** Selected by `session.user.id` only.
- **Agent orders:** Selected by `moltbookAgentId === agent.id`; single-order fetch re-checks ownership.

No IDOR vulnerabilities identified in audited routes.

---

## 5. Webhooks

| Endpoint | Verification | Note |
|----------|--------------|------|
| Stripe | `stripe.webhooks.constructEvent(body, signature, secret)` | Signature verified. |
| Printful | HMAC-SHA256 with `PRINTFUL_WEBHOOK_SECRET` (hex). | If secret not set, warning logged and request accepted — set secret in production. |
| Printify | Optional `?secret=` query match to `PRINTIFY_WEBHOOK_SECRET`. | If unset, any POST is accepted — **set in production.** |
| BTCPay | Uses `BTCPAY_WEBHOOK_SECRET`. | Verify implementation in route if needed. |
| Boxo | `Authorization` header with base64(client_id:secret). | Server-side verification. |

---

## 6. Rate limiting

- Checkout, refund request, contact, and Loqate use `checkRateLimit()` with per-IP keys.
- Rate limit store is in-memory; for multi-instance production, consider Redis-backed limiter.
- **Recommendation:** Consider rate limiting for `GET /api/orders/[orderId]/status` (per IP or per orderId) to reduce abuse; and for admin API key auth to reduce brute-force surface.

---

## 7. CORS and front-end

- Public API (checkout, etc.) uses `Access-Control-Allow-Origin: *` with no credentials — appropriate for unauthenticated agent use.
- Admin and user APIs rely on same-origin or configured CORS; no broad wildcard for credentialed requests found in audited code.

---

## 8. Recommendations summary

| Priority | Item | Action |
|----------|------|--------|
| High | Order cancel authorization | **Done.** Cancel now requires session, admin, or `lookupValue`. |
| High | Printify webhook secret | Set `PRINTIFY_WEBHOOK_SECRET` in production and use it in webhook URL. |
| Medium | Order track secret | Set `ORDER_TRACK_SECRET` or ensure `AUTH_SECRET` is set in production; avoid default fallback. |
| Medium | Printful webhook secret | Set `PRINTFUL_WEBHOOK_SECRET` in production. Independent of Printify; no impact on Printify. |
| Low | Rate limiting | **Done.** Optional Redis-backed rate limiting (Upstash). Order status: 120/min per IP. Admin: 200/min per IP. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production for cross-instance limits. |
| Low | Orders by-session | Consider short-lived or one-time token if Stripe session_id in URL is a concern. |

---

## 9. Files audited (key)

- `src/lib/admin-api-auth.ts` — Admin API key and session.
- `src/lib/auth.ts` — better-auth config; `isAdminUser`.
- `src/lib/moltbook-auth.ts` — Moltbook token verification.
- `src/lib/order-track-token.ts` — Track token creation/verification.
- `src/app/api/orders/[orderId]/route.ts` — Full order (owner or admin).
- `src/app/api/orders/[orderId]/status/route.ts` — Status only (no auth).
- `src/app/api/orders/[orderId]/cancel/route.ts` — Cancel (auth fixed).
- `src/app/api/orders/[orderId]/track/route.ts` — Track (token required).
- `src/app/api/refund/lookup/route.ts` — Lookup (proof, no PII on fail).
- `src/app/api/refund/request/route.ts` — Request (proof, rate-limited).
- `src/app/api/agent/me/orders/*` — Agent orders (scoped by agent id).
- `src/app/api/webhooks/*` — Stripe, Printful, Printify handlers.
- `src/app/api/support-tickets/[id]/route.ts` — User-scoped.
- `src/app/api/user/profile/route.ts` — Session-scoped.
- `src/app/api/dashboard/counts/route.ts` — Session-scoped.

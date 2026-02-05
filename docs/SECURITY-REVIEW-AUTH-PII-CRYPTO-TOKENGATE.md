# Security Review: Auth, PII, Crypto Payments, Crypto Auth, Token Gating

**Date:** February 5, 2026  
**Scope:** Customer authentication, customer PII, crypto payments, crypto authentication, token gating.

---

## 1. Customer Authentication

### Implemented controls

- **better-auth** with Drizzle adapter; sessions in DB; cookie-based with configurable cache (5 min).
- **Trusted origins** allowlist: dev (localhost 3000/3001), production from `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_APP_URL`, `NEXT_SERVER_APP_URL`, and Vercel URL. No wildcard.
- **API auth helpers:** `requireAuth(request)` and `getCurrentUser()` for protected routes; session validated via `auth.api.getSession({ headers })`.
- **Account linking** with `allowDifferentEmails: false` and trusted providers (solana, ethereum, social).
- **2FA** supported via better-auth twoFactor plugin (schema present).

### Findings and recommendations

| Item | Severity | Status / Action |
|------|----------|------------------|
| Session cookie in dev uses `sameSite: "none"` for admin↔main app; production should use `sameSite: "lax"` or `"strict"` for main app. | Low | Confirm production cookie config (e.g. not overriding to `none`). |
| Auth errors in `requireAuth` are logged with `console.error`; avoid logging sensitive request data. | Low | Keep; ensure no PII in logs. |
| Rate limiting on auth | Info | Rate limiter exists (`RATE_LIMITS.auth`); ensure auth routes use it where appropriate. |

**Verdict:** Authentication is in good shape: explicit origins, server-side session checks, and consistent use of `requireAuth` / session for protected APIs.

---

## 2. Customer PII (Address, ID, Phone, Email)

### Implemented controls

- **Order access:** `GET /api/orders/[orderId]` returns order only if requester is **owner** (session `user.id` or normalized email matches order) or **admin** (`getAdminAuth`). No IDOR for orders.
- **Admin customer API:** `GET /api/admin/customers/[id]` requires **admin** (session + `isAdminUser`). PII (name, email, phone, addresses) only for admins.
- **User profile API:** `GET/PATCH /api/user/profile` scoped to **current user** (`eq(userTable.id, session.user.id)`). No `id` in path; no cross-user access.
- **Checkout PII at rest:** Shipping form (email, name, address, phone) stored in **secure storage** (AES-GCM via Web Crypto, key from PBKDF2 + `NEXT_PUBLIC_STORAGE_ENTROPY` + session). Sync wrapper uses in-memory cache; fallback to plain localStorage only on encrypt failure (with console error).

### Findings and recommendations

| Item | Severity | Status / Action |
|------|----------|------------------|
| `NEXT_PUBLIC_STORAGE_ENTROPY` | Medium | **Set in production** to a long, random value. Default is weak and same across installs. |
| Secure storage fallback to unencrypted | Medium | Documented; avoid storing high-sensitivity secrets (e.g. payment credentials) in secure storage. |
| PII in logs | Low | Avoid logging full addresses, emails, or phone in server logs. |
| Admin session vs API key | Info | Admin APIs support both session and `ADMIN_API_KEY`; protect API key and rotate if exposed. |

**Verdict:** PII access is correctly restricted to owner or admin. Main improvement: set strong `NEXT_PUBLIC_STORAGE_ENTROPY` in production and avoid logging PII.

---

## 3. Crypto Payments

### Implemented controls

- **ETH/EVM confirm** (`/api/checkout/eth-pay/confirm`): **Rate limited**; loads order by `orderId`; verifies **on-chain** (getTransactionReceipt, recipient and amount/Transfer events); then marks paid. No trust of client for payment.
- **BTCPay confirm** (`/api/checkout/btcpay/confirm`): **Rate limited**; verifies invoice status via **BTCPay API** (`getBtcpayInvoiceStatus`, `isInvoiceSettled`); only then marks order paid.
- **BTCPay webhook** (`/api/webhooks/btcpay`): **Signature verification** when `BTCPAY_WEBHOOK_SECRET` is set (HMAC-SHA256 of raw body, timing-safe compare).
- **Solana Pay status** (`/api/payments/solana-pay/status`): Verifies transfer **on-chain** (`findTransferToAddress` / `validateTransfer` from `@solana/pay`).
- **Solana Pay confirm** (hardened in this review): Previously marked order paid **without** server-side verification. Now:
  - **Rate limited** (same checkout rate limit).
  - Requires **signature** and **amount** (and optional **splToken**) in the body.
  - **Verifies on-chain** with `validateTransfer(connection, signature, { recipient, amount, splToken })` before updating order to paid.
  - Clients (CheckoutClient, CryptoPayClient, use-solana-pay-polling) send `signature`, `amount`, and `splToken` to confirm.

### Findings and recommendations

| Item | Severity | Status / Action |
|------|----------|------------------|
| Solana Pay confirm trusted client | Critical | **Fixed.** Server now verifies transfer on-chain before marking paid. |
| Solana Pay confirm rate limiting | High | **Fixed.** Confirm endpoint now uses `RATE_LIMITS.checkout`. |
| Stripe webhook | Info | Ensure Stripe webhook signature verification is enabled and used (existing code should verify). |
| In-memory rate limit | Info | For multi-instance production, use a shared store (e.g. Redis) for rate limits. |

**Verdict:** Crypto payment confirmation is now aligned: ETH and BTCPay were already verified server-side; Solana Pay confirm now verifies on-chain and is rate limited. All confirmation flows are secure.

---

## 4. Crypto Authentication (Wallet Sign-In)

### Implemented controls

- **Ethereum (SIWE):** Challenge stores **nonce** in DB (verification table), 5 min expiry; verify uses **parseSiweMessage** + **verifySiweMessage** (viem); nonce checked and consumed from DB. Address format validated (regex `0x[a-fA-F0-9]{40}`).
- **Solana:** Challenge stores **nonce in message**; 5 min expiry; verify loads verification by `solana:${address}` and nonce; **nacl.sign.detached.verify** for message/signature/address. Address length validated.
- **Telegram:** **verifyTelegramHash** (HMAC-SHA256 of payload with bot token); no replay without valid hash.
- **Session creation:** After verify, session created via adapter; **setSessionCookie** with session and user. No session issued without valid proof.

### Findings and recommendations

| Item | Severity | Status / Action |
|------|----------|------------------|
| Ethereum auth logging | Low | `console.log` of address on verify; consider removing or reducing in production. |
| Nonce expiry | Info | 5 min is reasonable; verification record should be invalidated after use if desired (optional hardening). |

**Verdict:** Crypto auth is sound: server-issued nonces, signature verification (SIWE for Ethereum, nacl for Solana), and Telegram hash verification. No critical issues.

---

## 5. Token Gating

### Implemented controls

- **Challenge** (`/api/token-gate/challenge`): Returns a **timestamped message** (“Sign to prove wallet ownership for token gate:\n” + ISO timestamp). No server-side state; message is bound to time.
- **Validate** (`/api/token-gate/validate`): Requires **address**, **message**, **signature** (or **signatureBase58**), **resourceType**, **resourceId**. Checks: message format and **timestamp age (5 min)**; **Solana signature** (nacl); then **token gate config** for resource and **wallet balance** (e.g. SPL). Returns `valid` and optional `passedGate`.
- **TokenGateGuard (UI):** Calls challenge then validate with the same message/signature and resource; only shows content if `valid`. No server-side session for gating; each validation is signature + balance check.

### Findings and recommendations

| Item | Severity | Status / Action |
|------|----------|------------------|
| Challenge not bound to resource | Low | Message does not include `resourceType`/`resourceId`. Same signature could be reused for another resource within 5 min. **Hardening:** Include resourceType and resourceId in the challenge message and in validate so the signature is bound to one resource. |
| Replay window | Info | 5 min is acceptable; binding challenge to resource (above) reduces cross-resource replay. |
| Rate limiting | Info | Consider rate limiting challenge and validate by IP or address to prevent abuse. |

**Verdict:** Token gating correctly verifies wallet ownership and on-chain balance. Optional improvement: bind challenge to resource and add rate limiting.

---

## 6. Summary

| Area | Status | Critical fix applied |
|------|--------|------------------------|
| Customer authentication | Good | — |
| Customer PII | Good | Set `NEXT_PUBLIC_STORAGE_ENTROPY` in prod |
| Crypto payments | Good | **Solana Pay confirm** now verifies on-chain and is rate limited |
| Crypto authentication | Good | — |
| Token gating | Good | Optional: bind challenge to resource |

**Code changes made in this review:**

1. **`/api/checkout/solana-pay/confirm`**  
   - Rate limiting added.  
   - Server now requires `signature` and `amount` (and optional `splToken`) and verifies the transfer on-chain with `validateTransfer()` before marking the order paid.  
   - Clients updated to send `amount` and `splToken`: `use-solana-pay-polling.ts`, `CheckoutClient.tsx`, `CryptoPayClient.tsx`.

No other code changes were required for the scope of this review.

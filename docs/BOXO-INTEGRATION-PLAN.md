# Boxo Integration Plan — eCommerce Store

This document is an **implementation plan** and status log. It is based on a review of [Boxo’s documentation](https://docs.boxo.io/main/homepage) and the current relivator/Cult eCommerce store.

---

## Implementation status (eSIM)

- **Web SDK**: npm package **`@appboxo/web-sdk`** — “Boxo Desktop Host App SDK”; embeds miniapps in a container via `mount({ container })` (iframe). API: `new AppboxoWebSDK({ clientId, appId })`, then `sdk.mount({ container })`, `sdk.destroy()` for cleanup.
- **eSIM category**: Added to seed (in `SHOP_CATEGORIES`); included in `db:seed-categories` and thus in `db:seed:staging` / `db:seed:production`. Slug: `esim`. Full SEO: title, metaDescription, description.
- **eSIM category page** (`/esim`): Renders category hero + embedded Boxo eSIM miniapp via `ESimMiniappClient` (uses `@appboxo/web-sdk`). When `NEXT_PUBLIC_BOXO_CLIENT_ID` and `NEXT_PUBLIC_BOXO_ESIM_APP_ID` are set, the miniapp iframe is mounted; otherwise a “configure Boxo” message is shown.
- **Env (optional)**:
  - `NEXT_PUBLIC_BOXO_CLIENT_ID` — Boxo host app client id (from [dashboard.boxo.io](https://dashboard.boxo.io) → My host apps).
  - `NEXT_PUBLIC_BOXO_ESIM_APP_ID` — eSIM miniapp app id (from Boxo after eSIM integration is approved).
- **Boxo Connect & Payments APIs**: Implemented. See **Step 7: Dashboard URLs** below for what to enter in the Boxo dashboard.

---

## Step 7: Dashboard URLs (Boxo Connect & Payments)

Use your store’s base URL (e.g. `https://yourstore.com` or `http://localhost:3000` for dev). Replace `<BASE_URL>` below.

### Boxo Connect (Integration keys → Boxo connect section)

| Field | Value |
|-------|--------|
| **Single sign on enabled** | Turn **ON** |
| **Access token URL** | `https://<BASE_URL>/api/boxo/connect/access-token` |
| **Refresh token URL** | `https://<BASE_URL>/api/boxo/connect/refresh-token` |
| **User data URL** | `https://<BASE_URL>/api/boxo/connect/user-data` |
| **Access token prefix** | `Token` (default; or set `BOXO_ACCESS_TOKEN_PREFIX` in env to match) |
| **User consent links** | Add items (e.g. Title: "Terms & Conditions", URL: your terms page; "Privacy Policy", "FAQ") so they appear in the SSO modal. |

**Env (server-side, not `NEXT_PUBLIC_`):**

- `BOXO_CLIENT_ID` — same as your host app client id (or omit and rely on `NEXT_PUBLIC_BOXO_CLIENT_ID`).
- `BOXO_SECRET_KEY` — secret key from Boxo Integration keys (keep secret).
- `BOXO_ACCESS_TOKEN_PREFIX` — optional; default `Token`.

When the eSIM miniapp calls login, the frontend requests an auth code from `POST /api/boxo/auth-code` (user must be signed in); Boxo then calls the access token and user data URLs to complete SSO.

### Payments (Integration keys → Payments section)

| Field | Value |
|-------|--------|
| **Payments enabled** | Turn **ON** |
| **Create order payment URL** | `https://<BASE_URL>/api/boxo/payments/create-order` |
| **Get order payment status URL** | `https://<BASE_URL>/api/boxo/payments/status` |
| **Use access token** | Optional; leave OFF if using client_id/secret auth. |

Payments create a record in `boxo_order_payment` with status `in_process`. To complete the flow you will later: (1) show payment UI when the Web SDK fires a payment event, (2) charge the user (e.g. Polar or your checkout), (3) update the row to `paid` / `failed` / `cancelled` (and optional `payment_fail_reason`). Boxo will poll the status URL until the status is final.

---

## 1. Executive Summary

**Boxo** is a miniapp platform that lets “host apps” embed small web apps (miniapps) and optionally share identity (Boxo Connect) and payments (Boxo Payments) with them. Documentation: [Start Building](https://docs.boxo.io/main/homepage), [Documentation index (llms.txt)](https://docs.boxo.io/llms.txt).

Two integration directions are relevant:

| Direction | Description |
|----------|-------------|
| **A. Store as Host App** | Our eCommerce store embeds Boxo miniapps (e.g. partner services, eSIM, VPN) using the Boxo Web SDK. Optional: Boxo Connect (SSO) and Boxo Payments so miniapps can use our users and payment. |
| **B. Store as Miniapp** | Our store is registered as a Boxo miniapp so other super-apps can embed our store inside their apps (mobile or web). |

This plan focuses on **Direction A** (store as host app) as the primary interpretation of “implementing the web app into our eCommerce store,” with Direction B outlined as a later phase.

---

## 2. Boxo Concepts (from docs)

- **Host app**: The app that embeds miniapps (here: our Next.js eCommerce store).
- **Miniapp**: A web app listed in Boxo’s Showroom, launched by `app_id`. Can be third-party or our own.
- **Boxo SDK**: Used by the host app to launch miniapps. Platforms: iOS, Android, Flutter, React Native, Capacitor, Expo, **Web SDK**.
- **Boxo Connect**: SSO — host app shares user data with miniapps (OAuth or Direct flow). Requires backend endpoints or calling Boxo’s `/api/v1/connect/`.
- **Boxo Payments**: Host app can process payments for miniapp orders (create order payment, return `order_payment_id`, handle confirmation and status).
- **Showroom**: Catalog of miniapps; host apps request integration for miniapps they don’t own; Boxo provides `app_id` after approval.

---

## 3. Current Store Context

- **Stack**: Next.js 15, React 19, better-auth, Drizzle/Postgres, Polar (subscriptions), crypto (Solana Pay, ETH, BTCPay, TON).
- **Channels**: Web, Telegram Mini App (`/telegram` with cart, checkout, orders, notifications).
- **Auth**: better-auth (email, OTP, social, Solana, Ethereum, Telegram).
- **Checkout**: `CheckoutClient`, create-order APIs per payment method, order schema with optional `telegram_user_id` etc.
- **Docs**: `TELEGRAM-MINI-APP.md` describes a similar “embed channel” pattern (store inside Telegram); Boxo is another channel (store embeds third-party miniapps, or store is embedded elsewhere).

Reuse: layout patterns (e.g. `/telegram` layout with script + chrome), API route conventions, auth session resolution, and checkout/order flows where applicable.

---

## 4. Prerequisites (Boxo side)

1. **Dashboard**: [dashboard.boxo.io](https://dashboard.boxo.io/) — create account.
2. **Host app**: In “My host apps” → “Add super app” → name the app → obtain **client_id** (and later configure **client secret** for server calls).
3. **Miniapp access**:
   - If we **own** the miniapp: get **app_id** from miniapp settings.
   - If we **don’t own** it: request integration from the miniapp’s Showroom page; Boxo coordinates with the miniapp owner; we get **app_id** when approved.
4. **Optional — Boxo Connect**: Enable in Dashboard → Partnerships; configure URLs for “Get access token” and “Get user data” (or use Direct flow and call Boxo’s `/api/v1/connect/`).
5. **Optional — Boxo Payments**: Enable in Dashboard; configure “Create order payment” and “Get order payment status” URLs; optionally “Use access token” from Connect.

---

## 5. Implementation Plan — Direction A: Store as Host App

### 5.1 Phase 1: Web SDK and launch miniapp (no Connect/Payments)

**Goal**: Load Boxo Web SDK, initialize with `client_id`, and open a miniapp by `app_id` from our store (e.g. a “Partner services” or “eSIM” section).

**Tasks**:

1. **Web SDK surface** ✅
   - **npm**: `@appboxo/web-sdk` — “Boxo Desktop Host App SDK”. Embeds miniapp in a DOM container via iframe; `new AppboxoWebSDK({ clientId, appId })`, then `sdk.mount({ container })`. No script tag; bundle only on routes that use it (e.g. `/esim`).

2. **Environment**
   - Add `NEXT_PUBLIC_BOXO_CLIENT_ID` (and keep any secret only on server).

3. **Route and UI**
   - Option A: New route, e.g. `/miniapps` or `/partner-services`, with a list/grid of available miniapps (from `getMiniapps()` if Web SDK exposes it) or a fixed set of `app_id`s from env/config.
   - Option B: Integrate into an existing section (e.g. “eSIM” or “Services” in nav/footer) that opens a specific miniapp.
   - Ensure one clear place where `Boxo.setConfig({ clientId })` and `Boxo.openMiniapp(appId)` (or Web SDK equivalent) are called.

4. **Sandbox vs production**
   - Use Boxo sandbox mode in development so “In Testing” miniapps are available; disable sandbox in production (approved only).

5. **Logout**
   - On store logout, call Boxo’s logout (e.g. `Boxo.logout()`) so miniapp storage is cleared (docs require this for Connect).

**Deliverables**: One or more pages where a user can open at least one Boxo miniapp from our domain; no SSO or payments yet.

---

### 5.2 Phase 2: Boxo Connect (SSO)

**Goal**: When a miniapp calls `Boxo.login()`, our backend provides identity so the miniapp can recognize the store user (optional but needed if miniapps require login).

**Options** (per Boxo docs):

- **OAuth-style**: Boxo calls our “Get access token” and “Get user data” endpoints.
- **Direct**: We call Boxo’s `POST /api/v1/connect/` with `client_id`, `app_id`, and `user_data`; Boxo returns token/refresh_token we pass to the SDK.

**Tasks**:

1. **Dashboard**
   - Enable Connect in [Partnerships](https://dashboard.boxo.io/partnerships/).
   - For OAuth: set “Get access token” and “Get user data” URLs to our API routes (see below).
   - Store `client_id` and `client_secret` (and optional auth prefix) in env.

2. **Backend — Get access token (OAuth flow)**
   - New route, e.g. `POST /api/boxo/connect/access-token`.
   - Boxo sends `auth_code` in body; we validate it (we must have issued this code when the SDK requested it).
   - Implementation: when our frontend receives an “onAuth” (or equivalent) from the Web SDK, frontend calls our API to create an auth code (or reuse session), then our API that Boxo calls exchanges that code for an access token (and optionally refresh token). Return `{ access_token, refresh_token? }` or `{ error_code }` per [Boxo Connect](https://docs.boxo.io/host-apps/BoxoConnect).
   - Verify requests using `Authorization: <prefix> <base64(client_id:client_secret)>` and headers `X-Miniapp-App-ID`, `X-Hostapp-Client-ID` (and optional IP whitelist).

3. **Backend — Get user data (OAuth flow)**
   - New route, e.g. `GET /api/boxo/connect/user-data`.
   - Boxo sends `Authorization: Token <access_token>`; we validate token and return `user_data`: `reference` (our user id), `email`, `phone`, `first_name`, `last_name`, `custom_attributes` as per Boxo. Return 200 with `user_data` or `error_code`.

4. **Mapping store user → Boxo user**
   - Use better-auth session in the host app; when miniapp triggers login, frontend (or backend) generates a one-time auth code tied to the session, or we use Direct flow and send existing user fields to Boxo `/api/v1/connect/` and get tokens back to pass to the SDK.

5. **Direct flow (alternative)**
   - Skip our “get access token” / “get user data” endpoints; on miniapp login we call Boxo `POST /api/v1/connect/` with `client_id`, `app_id`, and `user_data` (from our session). Boxo returns `token` and `refresh_token`; our frontend passes these to the SDK (e.g. `Boxo.setAuthTokens(...)`). Requires partnership/Direct enabled in dashboard and correct auth (IP whitelist or request signaturing).

6. **Frontend**
   - On Boxo lifecycle “onAuth”, call our backend to get auth code or tokens, then call `Boxo.setAuthCode(...)` or `Boxo.setAuthTokens(...)` per Web SDK docs.

7. **Security**
   - Whitelist Boxo production IP `18.136.43.253` for these routes (or use request signaturing). Never expose client secret to the client.

**Deliverables**: Miniapps that support Boxo Connect can log the user in with store identity; backend endpoints and env documented.

---

### 5.3 Phase 3: Boxo Payments

**Goal**: Miniapps can create orders and charge the user via our store’s payment systems (e.g. Polar, or later crypto). Boxo platform calls our “create order payment” and “get order payment status” endpoints; we show payment UI and report status back.

**Tasks**:

1. **Dashboard**
   - Enable Boxo Payments in Partnerships; set “Create order payment” and “Get order payment status” URLs; optionally enable “Use access token” (from Connect).

2. **Backend — Create order payment**
   - New route, e.g. `POST /api/boxo/payments/create-order`.
   - Boxo sends `app_id` and `order` (amount, currency, items, shipping, etc. per [Boxo Payments](https://docs.boxo.io/host-apps/BoxoPayments)). We create an internal order/payment (e.g. Polar checkout or internal invoice) and return `order_payment_id` (and optional `custom_attributes`). Auth: same as Connect (Bearer or Basic with client_id/secret, plus `X-User-ID` for host user reference).

3. **Backend — Get order payment status**
   - New route, e.g. `POST /api/boxo/payments/status` (or GET if configured). Boxo sends `app_id`, `client_id`, `order_payment_id`. We return `payment_status`: `in_process` | `paid` | `cancelled` | `failed` (and optional `payment_fail_reason`, `custom_attributes`).

4. **Miniapp completion**
   - Boxo sends completion to the miniapp’s backend (not ours). We only need to update our payment state when the user pays (e.g. Polar webhook or our polling) and then respond correctly to “get order payment status”.

5. **Frontend (if Web SDK supports payment events)**
   - If the Web SDK exposes payment events (similar to native “didReceivePaymentEvent”), we show our payment UI (e.g. redirect to Polar checkout, or in-app form), and on success/cancel call the SDK to send payment result (e.g. `status: 'paid'` / `'cancelled'` / `'failed'`). If Web SDK does not support this, payments might be limited to native host apps; confirm with Boxo.

6. **Idempotency and reconciliation**
   - Map `order_payment_id` to our internal order/invoice so we can reconcile and avoid double-charging.

**Deliverables**: Create/status API routes; payment flow documented; optional frontend payment handling if supported on web.

---

### 5.4 Phase 4: Security, reliability, and ops

- **Whitelisting**: Restrict Boxo callback routes to Boxo IP(s) or request signaturing per [Security measures](https://docs.boxo.io/host-apps/SecurityMeasures).
- **Request signaturing**: If required or desired, implement signing for Connect/Payments requests per [Signaturing](https://docs.boxo.io/host-apps/Signaturing).
- **Error codes**: Return Boxo-defined error codes for Connect and Payments so the platform and miniapps can handle failures ([Error Codes](https://docs.boxo.io/host-apps/ErrorCodes)).
- **Consent**: If using Connect, implement consent flow; Boxo provides `GET /api/v1/accounts/consent/get_consent/`; we may need to store and respect user consent per miniapp.
- **Monitoring**: Log and monitor Boxo routes (rate, errors, latency); alert on failures.

---

### 5.5 Phase 5: UX and discovery

- **Miniapp list**: If Web SDK supports `getMiniapps()`, show catalog (with sandbox off in prod so only approved miniapps appear); otherwise maintain a curated list of `app_id`s in config.
- **Deep links**: If we later support opening our store from external links that should open a miniapp, parse deeplinks and call Web SDK to open miniapp (and optional path) per [DeepLink](https://docs.boxo.io/host-apps/DeepLink).
- **Theming**: If the Web SDK supports theme (e.g. dark/light), align with store theme.
- **Custom events**: If we need host ↔ miniapp communication beyond login/pay, use [Custom Events System](https://docs.boxo.io/host-apps/CES) (host listens and optionally sends events back).

---

## 6. Implementation Plan — Direction B: Store as Miniapp

**Goal**: Allow other Boxo host apps (e.g. super-apps) to embed our store so their users can browse and buy without leaving the host app.

**Tasks** (high level):

1. **Register in Boxo**
   - Add our store as a miniapp in Boxo (URL: e.g. `https://our-store.com/boxo` or root with query param). Get **app_id** and miniapp settings.

2. **Miniapp entry**
   - Dedicated route or detection (e.g. `/boxo` or `?embed=boxo`) that loads the Boxo **miniapp** JS SDK (not host SDK), so our store can call `appboxosdk.login`, payment, etc., when running inside a host app.

3. **Connect (as miniapp)**
   - When our store runs inside a host and user clicks “Sign in”, we call Boxo miniapp login; host app provides user data via Boxo; our backend receives user from Boxo (or we get token and fetch user). Map to our user table or create guest/account.

4. **Payments (as miniapp)**
   - For orders placed from our store inside a host app, we may use host’s payment (Boxo Payments) so the user pays in the host app’s flow. Our backend would implement the **miniapp side** of Boxo Payments (create order in our system, call Boxo to create order payment, receive completion from Boxo). Document in a separate “Store as Miniapp” plan.

5. **UI/UX**
   - Responsive, minimal chrome when in embed mode; follow [Miniapp Design](https://docs.boxo.io/miniapp/Design) and [UI Best Practice](https://docs.boxo.io/main/uibest).

This is a larger change (store must behave as both standalone and embeddable). Recommended as a follow-up after Direction A is live.

---

## 7. Documentation and References

- **Boxo**
  - [Start Building](https://docs.boxo.io/main/homepage)
  - [Docs index — llms.txt](https://docs.boxo.io/llms.txt)
  - [Host Apps — Introduction](https://docs.boxo.io/host-apps/introduction)
  - [Host Apps — Getting Started](https://docs.boxo.io/host-apps/GettingStarted)
  - [Boxo SDK](https://docs.boxo.io/host-apps/BoxoSDK) (iOS, Android, Flutter, React Native, Capacitor, Expo, Web SDK)
  - [Boxo Connect](https://docs.boxo.io/host-apps/BoxoConnect)
  - [Boxo Payments](https://docs.boxo.io/host-apps/BoxoPayments)
  - [Security measures](https://docs.boxo.io/host-apps/SecurityMeasures)
  - [DeepLink](https://docs.boxo.io/host-apps/DeepLink)
  - [Error Codes](https://docs.boxo.io/host-apps/ErrorCodes)
- **Store**
  - `docs/TELEGRAM-MINI-APP.md` — similar “store in another surface” pattern
  - `docs/Culture Store Thesis.md` — channels and products (eSIM, VPN, etc.)
  - `README.md` — stack and commands

---

## 8. Suggested Order of Work (Direction A)

1. **Clarify Web SDK** — Confirm package/script and launch flow for web (no implementation yet).
2. **Phase 1** — Add `NEXT_PUBLIC_BOXO_CLIENT_ID`, one route (e.g. `/miniapps` or section in existing page), load SDK and open one miniapp; call `Boxo.logout()` on store logout.
3. **Phase 2** — Implement Boxo Connect (OAuth or Direct); add API routes and dashboard URLs; test with a miniapp that uses Connect.
4. **Phase 3** — Implement Boxo Payments (create order + status); optional frontend payment handling if Web SDK supports it.
5. **Phase 4** — Security (whitelist/signaturing), error codes, consent, monitoring.
6. **Phase 5** — Discovery, theming, deeplinks, custom events as needed.

---

## 9. Open Points

- **Web SDK**: Exact API (npm vs script, method names for `openMiniapp`, `setConfig`, `logout`, `getMiniapps`, lifecycle, payment events) to be confirmed from Boxo Web SDK docs or support.
- **Product fit**: Which miniapps to integrate first (e.g. eSIM from Showroom) and where they appear in the store (nav, footer, dedicated “Partner services” page).
- **Payments**: Whether our first use case is “miniapp orders paid via our Polar/crypto” or “we only embed miniapps, no shared payments”; this drives whether Phase 3 is required for MVP.
- **Direction B**: Timeline and resourcing for “store as miniapp” (separate plan and backlog).

---

*Document created from Boxo documentation review and store codebase inspection. No implementation has been done.*

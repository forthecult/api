<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Telegram Mini App — Plan & Integration

This document plans and confirms the flow for turning For the Cult into a **Telegram Mini App**, so users can browse, cart, and pay from inside Telegram. **Payments:** crypto only (Solana Pay, ETH, BTCPay, TON, etc.). **Telegram Stars** is for digital services, not physical goods, so we do not use it for this store.

---

## How many bots?

You need **2 bots**, not 3:

| Bot | Purpose | Token / config |
|-----|--------|----------------|
| **Store bot** | Telegram **Login Widget** (sign-in on website), **Mini App** (store inside Telegram), and **order notifications** (shipped/fulfilled → DM). All use the same bot. | `TELEGRAM_BOT_TOKEN` + `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` |
| **Alice (OpenClaw) bot** | AI assistant in Telegram: users message the bot, OpenClaw backend replies. Separate bot so the store and the AI have different @usernames and tokens. | OpenClaw / Alice config (see `docs/OPENCLAW-ALICE.md`) |

- **Telegram authentication** = Store bot + the two env vars below. No separate “auth bot.”
- **Telegram Mini App** = Same Store bot; add Mini App URL in BotFather.
- **Telegram OpenClaw** = Alice bot (second bot).

---

## Telegram authentication (Login Widget) — setup

Sign-in with Telegram on the **website** (login/signup page) uses the [Telegram Login Widget](https://core.telegram.org/widgets/login). Code: `src/lib/auth-telegram-plugin.ts`, `src/ui/components/auth/telegram-login-widget.tsx`. The button only appears when `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set.

**Steps:**

1. **Create the Store bot** (if you don’t have it yet):
   - Open [@BotFather](https://t.me/BotFather) → `/newbot` → name + username (e.g. `YourStoreBot`).
   - Copy the **bot token** (e.g. `123456:ABC-Def...`).

2. **Set environment variables** (e.g. in `.env`):
   - `TELEGRAM_BOT_TOKEN=<token>` — server-only; used to verify the widget’s hash and (later) to send order notifications.
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourStoreBot` — bot username **without** `@`; used by the Login Widget script.

3. **Restart** the dev server so env is picked up.

4. **Test:** Open `/login` or `/signup`; the “Sign in with Telegram” option should appear. Click it, authorize in Telegram; you should be signed in and redirected.

**Linking Telegram to an existing account:** From Dashboard → Security (or the flow that shows “Link Telegram”), use the same widget with `link: true` so the Telegram account is attached to the current user (and order notifications via Telegram can be enabled in Settings → Notifications).

---

## 0. Current Status (Implemented)

| Area | Status |
|------|--------|
| **Bot setup** | Manual: create bot + Mini App URL in @BotFather |
| **`/telegram` layout** | ✅ Loads `telegram-web-app.js`; theme wrapper |
| **`/telegram` page** | ✅ TelegramStoreClient: products, MainButton “View Cart” |
| **`/telegram/cart`** | ✅ Full-page cart; “Proceed to checkout” → `/telegram/checkout` |
| **`/telegram/checkout`** | ✅ Same CheckoutClient inside Telegram layout; source=telegram |
| **MainButton / BackButton** | ✅ MainButton → `/telegram/cart`; BackButton on cart & checkout |
| **Orders schema** | ✅ `telegram_user_id`, `telegram_username`, `telegram_first_name` |
| **Checkout APIs** | ✅ Solana/ETH/BTC/TON create-order accept & persist Telegram user |
| **CheckoutClient** | ✅ `getTelegramOrderPayload()` when `source=telegram` or path `/telegram/*`; synthetic email `telegram_{id}@telegram.user` when in Telegram context |
| **Telegram Stars** | Not used (for services, not physical goods) |
| **Bot order notifications** | ✅ Vendor → our backend → Telegram only. Fulfilled/shipped/on_hold/cancelled; “View order” → `/telegram/orders/{id}` |
| **Telegram option for web users** | ✅ Users who sign in with Telegram (or link Telegram) can choose “Order notifications via Telegram” in Dashboard → Settings → Notifications; then order updates go to Telegram instead of email. |

---

## 1. Prerequisites (Your Side)

| Step | Action | Notes |
|------|--------|--------|
| 1 | Create bot via [@BotFather](https://t.me/BotFather) | `/newbot` → name + username (e.g. `yourstorebot`) |
| 2 | Create Mini App via BotFather | `/newapp` → select bot → **Web App URL**: `https://yourstore.com/telegram` |
| 3 | (Optional) Set bot commands | e.g. `/start` opens Mini App; can add “Shop”, “Orders” later |

**Production URL:** Set `NEXT_PUBLIC_APP_URL` (or equivalent) to your real domain; the Mini App URL must be HTTPS.

---

## 2. Architecture Overview

- **Mini App** = same Next.js app, served under `/telegram` (and optionally `/telegram/cart`, `/telegram/checkout`).
- **Auth:** No passwords. Telegram provides `initData` (and optionally `initDataUnsafe.user`) when the app is opened from Telegram; we use this for identity and (optionally) order notifications.
- **Payments:** Crypto only (Solana Pay, ETH, BTCPay, TON, etc.). Telegram Stars is for digital services, not physical goods.
- **Order notifications:** Always **vendor → our backend → Telegram**. Printful/Printify (or admin) update our DB via webhooks or API; our backend then sends the Telegram message. Third parties never send to Telegram directly.

---

## 3. Implementation Steps (Confirmed)

### Step 1: Telegram Web App script (only on `/telegram`)

- **Where:** `src/app/telegram/layout.tsx`
- **What:** Load `https://telegram.org/js/telegram-web-app.js` in a `<Script>` tag so `window.Telegram.WebApp` is available.
- **Scope:** Only this layout (and its children) need the script; the rest of the site stays unchanged.

### Step 2: Telegram-specific route(s)

- **Main entry:** `src/app/telegram/page.tsx`
  - On mount: `tg.ready()`, `tg.expand()`, optionally `tg.setHeaderColor(tg.themeParams.bg_color)`.
  - Render the same store experience (product list, search, etc.) — reuse existing components (e.g. product grid, cart).
- **Optional dedicated routes:**
  - `/telegram/cart` — cart view.
  - `/telegram/checkout` — checkout; can reuse existing `CheckoutClient` with a “source=telegram” flag so we send Telegram user into the API.

**Design:** Use Telegram theme vars where it makes sense, e.g. `bg-[var(--tg-theme-bg-color)]`, so the app feels native inside Telegram.

### Step 3: MainButton & BackButton (optional but recommended)

- **MainButton:** e.g. “View Cart ($X.XX)”. On click → navigate to `/telegram/cart` (or open cart drawer if you have one).
- **BackButton:** Show when not on root; on click → `window.history.back()`.
- Update MainButton label when cart total changes (e.g. after add/remove).

### Step 4: Checkout and Telegram user identity

- **Backend:** Checkout APIs already accept `email` and optional `userId`. Extend to accept **Telegram user** so we can:
  - Associate the order with a Telegram user for support and notifications.
  - Optionally allow “no email” when Telegram user is present by using a synthetic email, e.g. `{telegramUserId}@telegram.user`, so existing flows (emails, Printful, etc.) still work.
- **Ways to pass Telegram user:**
  - **Option A (recommended):** Request body: `telegramUserId`, `telegramUsername`, and optionally `telegramFirstName` when creating the order (e.g. in `createOrderSchema` and in Solana/ETH/BTC Pay create-order handlers).
  - **Option B:** Header `X-Telegram-User` with JSON: `{ id, username, first_name }`. Server parses and stores on the order.
- **Schema:** Add to `order` table:
  - `telegram_user_id` (text, nullable)
  - `telegram_username` (text, nullable)
  - Optional: `telegram_first_name` (text, nullable) for display in admin.

When `telegram_user_id` is present, you can later:
- Send order updates via the Telegram Bot API (e.g. “Order shipped”, “Track package”).
- Show “Orders” in the Mini App by filtering orders by `telegram_user_id`.

### Step 5: Payment flow inside Telegram

- **Crypto (existing):** Same as today. After creating the order via `/api/checkout/solana-pay/create-order` (or ETH/BTC Pay), open the payment URL or QR in a way that works from Telegram:
  - `tg.openLink(paymentUrl)` for external wallet / BTCPay page, or
  - In-app Solana Pay link / QR so user pays from their wallet app and we poll status.
- **Telegram Stars:** When you’re ready:
  - Create an invoice (e.g. via Bot API or Telegram’s payment API).
  - On the checkout page, show a “Pay with Telegram Stars” button that calls `tg.openInvoice(invoiceUrl)`.
  - On success, your backend receives a webhook/callback; mark order as paid and fulfill.

For the “easiest” path, the plan keeps **crypto-only** first; Telegram Stars can be phase 2.

### Step 6: Bot order notifications (implemented)

- **Flow:** Vendor (Printful, Printify) or admin updates order → our webhook/API runs → we update DB → we call `notifyOrderUpdate(orderId, { kind, trackingNumber?, trackingUrl? })` in `~/lib/telegram-notify.ts`. Notifications are sent only from our backend; never from a third party (e.g. Printful) directly to Telegram.
- **Triggers:** Printful webhook (shipment_sent, shipment_delivered, order_updated, order_canceled, etc.), Printify webhook (order:shipment:delivered, order:updated canceled, etc.), admin PATCH when fulfillment status set to “fulfilled”.
- **Recipients:** (1) Order has `telegram_user_id` (placed from Mini App), or (2) order has `user_id` and that user has linked Telegram + `receive_order_notifications_via_telegram` = true (opted in via Dashboard → Settings → Notifications).
- **Message:** Shipped/fulfilled (with optional “Track package” + “View order” buttons), on_hold, or cancelled. “View order” opens `/telegram/orders/{orderId}` in the Mini App.
- **Requires:** `TELEGRAM_BOT_TOKEN` (same token as Mini App / Login Widget).

---

## 4. Data Flow (Summary)

1. User opens the bot → “Open App” or menu → Mini App loads `https://yourstore.com/telegram`.
2. Frontend reads `window.Telegram.WebApp.initDataUnsafe.user` (id, username, first_name).
3. User browses, adds to cart (cart can be in memory or synced to your API with a session/guest id).
4. On checkout, frontend calls your existing create-order API with:
   - Same payload as web (items, shipping, payment method).
   - Plus `telegramUserId`, `telegramUsername` (and optionally `telegramFirstName`); if no email, send `{telegramUserId}@telegram.user`.
5. Backend creates order, stores `telegram_user_id` / `telegram_username`, returns payment URL or instructions.
6. User pays (crypto); you confirm payment and fulfill.
7. When order status changes (vendor webhook or admin), our backend sends a Telegram message to `telegram_user_id` with tracking (if any) and “View order” → `/telegram/orders/{orderId}`.

---

## 5. Design (dark mode)

- The Mini App uses Telegram theme CSS variables (`--tg-theme-bg-color`, `--tg-theme-text-color`, `--tg-theme-button-color`, etc.) so the UI adapts to the user’s Telegram theme (light/dark). When Telegram is in dark mode, these vars are set by the client so text and backgrounds stay readable.
- On `/telegram` we hide the main site header, footer, and support chat widget to avoid duplicate chrome and overlapping elements; the in-app header shows “Shop” and a cart icon only.
- Secondary actions (e.g. “Continue shopping” on the cart page) use explicit theme vars for border and text so they remain readable in both themes.

---

## 6. Security Notes

- **Validate initData on the server** if you ever use it for auth or sensitive actions: Telegram signs `initData`; verify the hash using the bot token so clients can’t forge user id. For “identity only” and order association, many apps only validate when needed (e.g. before sending a notification to that user).
- **Rate limiting:** Keep existing checkout/cart rate limits; optionally add a stricter limit for requests that include `telegram_user_id` to avoid abuse.
- **CORS / iframe:** Telegram opens the Mini App in an iframe; your domain must be allowed in BotFather’s Web App URL. No extra CORS config needed for same-origin API calls from your Next.js app.

---

## 7. File Checklist

| File / area | Purpose |
|-------------|--------|
| `docs/TELEGRAM-MINI-APP.md` | This plan |
| `src/app/telegram/layout.tsx` | Load Telegram Web App script; minimal layout; mounts `TelegramChrome` |
| `src/app/telegram/telegram-chrome.tsx` | BackButton on `/telegram/cart` and `/telegram/checkout` |
| `src/app/telegram/page.tsx` | Main Mini App page: `TelegramStoreClient` (products, MainButton → `/telegram/cart`) |
| `src/app/telegram/TelegramStoreClient.tsx` | Store UI, MainButton “View Cart”, product grid |
| `src/app/telegram/cart/page.tsx` | Full-page cart; “Proceed to checkout” → `/telegram/checkout` |
| `src/app/telegram/checkout/page.tsx` | Checkout inside Telegram layout; `CheckoutClient` (source=telegram via pathname) |
| `src/db/schema/orders/tables.ts` | `telegram_user_id`, `telegram_username`, `telegram_first_name` (optional). **Run `bun run db:push`** if needed. |
| Checkout validation + create-order APIs | Accept and persist Telegram user fields; synthetic email `telegram_{id}@telegram.user` when from Telegram |
| `CheckoutClient` | `getTelegramOrderPayload()` when `source=telegram` or path `/telegram/*`; prefill email when in Telegram context |
| `src/lib/telegram-notify.ts` | `notifyOrderUpdate(orderId, { kind, trackingNumber?, trackingUrl? })`; called from Printful/Printify webhooks and admin PATCH |
| `src/app/telegram/orders/[orderId]/page.tsx` | Order status page for “View order” button in notifications |
| `user.receive_order_notifications_via_telegram` | User preference: when true + Telegram linked, order notifications go via Telegram. **Run `bun run db:push`** after adding column. |
| `src/app/api/user/notifications/route.ts` | GET/PATCH current user notification prefs; PATCH only allows Telegram option when `hasTelegramLinked`. |
| Dashboard Settings → Notifications | “Order notifications via Telegram” switch (shown when user has linked Telegram); “Link Telegram…” hint when not linked. |

---

## 8. Deployment

- Deploy the Next.js app as usual. No separate “Telegram app” build.
- Set the bot’s Mini App URL to `https://<your-domain>/telegram`.
- Ensure environment variables for bot token (and optional payment provider) are set when you add bot notifications or Telegram Stars.

Once the layout and `/telegram` page are in place and the bot’s Web App URL points to your domain, users can open the store inside Telegram and checkout with the same APIs; Telegram user is stored for support and future notifications.

# Adding a New Payment Method

This guide covers adding a new payment option (e.g. a new cryptocurrency) so it appears in **checkout**, **eSIM product/checkout page**, **admin**, and **footer**. Payment method **keys** (e.g. `crypto_cult`) must be consistent everywhere so discounts, reporting, and coupon rules work. **New methods are inserted in disabled mode** so they do not appear to customers until you enable them in Admin → Payment methods.

---

## Payment method key consistency

The same **method key** (e.g. `crypto_seeker`, `crypto_cult`) must be used in every place below. If the key is missing in any one place, that flow will not apply payment-method–restricted discounts (e.g. “20% off eSIM when paying with CULT”) or show the correct option.

| Use | Where |
|-----|--------|
| Registry & admin | `PAYMENT_METHOD_DEFAULTS[].methodKey` in `payment-method-settings.ts` |
| Visibility | `METHOD_KEY_MAP` in `checkout-payment-options.ts` (methodKey → PaymentVisibility flag) |
| Main checkout | `PaymentMethodSelector` → `paymentMethodKey` useMemo (sub-option → key) |
| Main checkout create-order | `handleGoToCryptoPay` token + `TOKEN_TO_PAYMENT_METHOD_KEY` in solana-pay create-order route |
| **eSIM product page** | **`esim-package-detail-client.tsx`**: CryptoSub type, `resolvedPayment`, `paymentMethodKey` map, `PAYMENT_METHOD_KEY_MAP` in `handlePurchase` |
| **eSIM crypto-checkout** | **`api/esim/crypto-checkout/route.ts`**: token → `cryptoCurrency` when updating the order (so the payment page shows the correct token, not SOL) |
| Admin coupons | `PAYMENT_METHOD_OPTIONS` in admin coupon create/edit pages |
| Coupon resolution | Backend uses the key from the request (`paymentMethodKey`) to match `rulePaymentMethodKey` on automatic discounts |

---

## 1. Customer front-end

### 1.1 Payment method registry and visibility

- **`src/lib/payment-method-settings.ts`**
  - Add an entry to `PAYMENT_METHOD_DEFAULTS`:
    - `methodKey`: e.g. `"crypto_seeker"` (used in DB, API, and everywhere below).
    - `label`: e.g. `"Seeker (SKR)"`.
    - `displayOrder`: number for ordering in admin and checkout.

- **`src/lib/checkout-payment-options.ts`**
  - **PaymentVisibility** type: add a boolean flag, e.g. `cryptoSeeker: boolean`.
  - **METHOD_KEY_MAP**: add mapping from `methodKey` to that flag, e.g. `crypto_seeker: "cryptoSeeker"`.
  - **DEFAULT_VISIBILITY**: set the new flag (e.g. `cryptoSeeker: true` for fallback when API has not loaded).
  - **CRYPTO_SUB_OPTIONS** (if it’s a crypto sub-option): add `{ value: "seeker", label: "Seeker (SKR)" }`.
  - **visibleCryptoSubFromVisibility**: add a case for the new option, e.g. `if (opt.value === "seeker") return v.cryptoSeeker`.
  - **hasAnyCryptoEnabled**: include the new flag in the OR chain.
  - **getPaymentOptionsForDisplay** (and **getPaymentIconPaths** if you use icons): add the new option and its icon path so it appears in the checkout crypto list when enabled.
  - **getFooterPaymentItems**: when `visibility` is set, add a branch for the new flag (e.g. `if (visibility.cryptoSeeker) items.push({ name: "Seeker (SKR)", src: "/crypto/seeker/..." })`). When `visibility === null`, add the same item to the fallback list if you want it in the footer before the API loads.

### 1.2 Main checkout: payment method key and token

The checkout payment card lives in **`src/app/checkout/components/PaymentMethodSelector.tsx`**. (CheckoutClient uses it via **PaymentMethodSection.tsx**, which re-exports PaymentMethodSelector.)

- **Payment method key (for discounts and reporting)**  
  In the **`paymentMethodKey` useMemo** in `PaymentMethodSelector.tsx`, add a branch so the selected crypto sub-option maps to your method key:
  - e.g. `if (sub === "seeker") return "crypto_seeker";`
  - This key is passed to the parent and used for automatic coupon resolution (e.g. “20% off when paying with CULT”) and order bookkeeping.

- **Create-order token (Solana Pay)**  
  In **`handleGoToCryptoPay`**, the `token` variable sent in the request body to `/api/checkout/solana-pay/create-order` must include your option. Add e.g.:
  - `: paymentMethod === "crypto" && paymentSubOption === "seeker" ? "seeker"`
  - before the final `"solana"` fallback. **If you skip this, the payment page will show “Pay with SOL” instead of the selected token.**

- **Supported flag**  
  Add the new option to the condition that determines whether the “Pay with …” button is shown (e.g. for Solana Pay: `(paymentMethod === "crypto" && paymentSubOption === "seeker")` in `isSolanaPaySupported`).

- **Pay button label**  
  In the branch that renders the main pay button (e.g. Solana Pay), add a label for the new option, e.g. `: paymentMethod === "crypto" && paymentSubOption === "seeker" ? "Pay with Seeker (SKR)" : ...`.

- **Crypto total label (recommended for tokens with a USD price)**  
  So customers see the order total in the selected token (e.g. “≈ 123 SKR”) in the Order summary and, on mobile, in the sticky “Place order” bar:
  - In **`cryptoTotalLabel`** (useMemo in `PaymentMethodSelector.tsx`): add a branch for your sub-option, e.g. `if (paymentSubOption === "seeker") { const rate = cryptoPrices.SKR; ... return \`≈ ${formatCrypto(amount, 6)} SKR\`; }`.
  - Add the price key to: **`cryptoPrices`** state type (e.g. `SKR?: number`), the **fetch callback** type for `/api/crypto/prices`, and the **useMemo dependency array** (e.g. `cryptoPrices.SKR`). The prices API must return this key (see 1.6).

- **Crypto row icons**  
  In the `cryptoRowIcons` useMemo, add e.g. `if (visibility.cryptoSeeker) icons.push({ alt: "Seeker (SKR)", src: "/crypto/seeker/..." })`.

### 1.3 Checkout payment constants and crypto pay client (Solana / SPL tokens)

- **`src/app/checkout/checkout-payment-constants.ts`**
  - Add the option to the type that includes all crypto sub-options (e.g. `| "seeker"`).
  - In the options array used for the radio list, add `{ value: "seeker", label: "Seeker (SKR)" }`.
  - In the icon map, add e.g. `seeker: "/crypto/seeker/S_Token_Circle_White.svg"`.

- **`src/app/checkout/crypto/CryptoPayClient.tsx`**
  - Add the token to the Solana tokens list and to any types that list tokens.
  - Add icon, label, and short label (e.g. “SKR”) for the token.
  - Add price handling (e.g. fetch price from `/api/crypto/prices` or use existing price hook) and amount calculation.
  - In the “Pay” / create-order flow, pass the correct token and method key so the backend creates the order with the right payment method.

### 1.4 Create-order API (e.g. Solana Pay)

- **`src/app/api/checkout/solana-pay/create-order/route.ts`** (or the route for your chain)
  - In **SOLANA_TOKEN_TO_CURRENCY**, add the mapping from the request token to the stored `cryptoCurrency` (e.g. `seeker: "SKR"`). The payment page uses this so it can show the correct token (amount, label, QR) via the order fetch API.
  - In **TOKEN_TO_PAYMENT_METHOD_KEY**, add the mapping from the token to the payment method key, e.g. `seeker: "crypto_seeker"`. This is used for discount resolution and reporting. **The token value must match what the frontend sends in `handleGoToCryptoPay`.**

### 1.5 Order fetch API (payment page token) — Solana / SPL tokens only

- **`src/app/api/checkout/orders/[orderId]/route.ts`**
  - In **SOLANA_CURRENCY_TO_TOKEN**, add the mapping from the stored `cryptoCurrency` (e.g. `"SKR"`) to the frontend token value (e.g. `"seeker"`): e.g. `SKR: "seeker"`. The payment page uses this to show the correct token (amount, label, QR). **If you skip this, the payment page may show the wrong currency (e.g. SOL) even when the order was created with the new token.**

### 1.6 Crypto prices (if the new token has a USD price)

- **`src/app/api/crypto/prices/route.ts`**
  - Add the token to the response type and fetch its price (e.g. from CoinGecko or another provider).
  - Add a fallback price in `FALLBACK_PRICES` if desired.
  - **Required for crypto total label**: the prices API is used by `PaymentMethodSelector` (see 1.2). If the API does not return this key, the `cryptoTotalLabel` for your token will be `null` and the amount will not show in the Order summary or the mobile “Place order” bar.

### 1.7 eSIM product page (direct eSIM purchase)

The **eSIM product/checkout page** (`/esim/[packageId]`) has its own payment UI and calls **`POST /api/esim/purchase`** (and optionally **`/api/esim/crypto-checkout`** for crypto). For payment-method–restricted automatic discounts (e.g. “20% off eSIM when paying with CULT”) to apply and for the discount preview to show, the eSIM page must send the same **payment method key** as the main checkout. If any of the following are missing, the discount will not apply on the eSIM page (but may still apply on the main cart checkout).

All edits are in **`src/app/esim/[packageId]/esim-package-detail-client.tsx`**:

1. **CryptoSub type**  
   Add the new option to the `CryptoSub` union type, e.g. `| "seeker"`.

2. **resolvedPayment useMemo**  
   When the user selects the new crypto, the payment payload (method, hash, token) must be set. Add a branch, e.g.:
   - `if (cryptoSub === "seeker") return { hash: "#solana", method: "solana_pay" as const, token: "seeker" };`
   - Use the same `token` value that the main checkout and create-order API expect.

3. **paymentMethodKey useMemo**  
   This key is used to fetch the **automatic discount preview** from `POST /api/checkout/coupons/automatic`. Without it, the eSIM page will not show “X% off” or the discounted total when the user selects this payment method. Add to the map, e.g.:
   - `seeker: "crypto_seeker",`
   - Keys must match `PAYMENT_METHOD_DEFAULTS.methodKey` and admin coupon `rulePaymentMethodKey`.

4. **handlePurchase → PAYMENT_METHOD_KEY_MAP**  
   When the user clicks “Buy eSIM”, the request body to **`POST /api/esim/purchase`** must include **`paymentMethodKey`** so the backend can apply the automatic coupon. In `handlePurchase`, add the same entry to **PAYMENT_METHOD_KEY_MAP**, e.g.:
   - `seeker: "crypto_seeker",`
   - The backend only runs discount resolution when `paymentMethodKey` is present; if it’s omitted, the order is created at full price.

**Summary**: same key in all four places (CryptoSub, resolvedPayment, paymentMethodKey map, PAYMENT_METHOD_KEY_MAP) so the eSIM page shows the correct payment option, requests the discount preview, and sends the key on purchase.

### 1.8 eSIM crypto-checkout API (payment page token)

When the customer selects crypto on the eSIM product page and clicks “Buy eSIM”, the frontend calls **`POST /api/esim/crypto-checkout`** with `orderId`, `paymentMethod`, and **`token`** (e.g. `"cult"`). The backend updates the order with a deposit address and must set **`cryptoCurrency`** (e.g. `"CULT"`) so the payment page knows which token to show.

- **`src/app/api/esim/crypto-checkout/route.ts`**  
  In the Solana Pay branch, the mapping from request `token` to stored **`cryptoCurrency`** must include your token. Add e.g. `solToken === "cult" ? "CULT"` in the chain (same value as in `SOLANA_TOKEN_TO_CURRENCY` in the main create-order route). **If you skip this, the order is updated with no or wrong `cryptoCurrency`, and the payment page (which reads from GET `/api/checkout/orders/[orderId]`) will show the wrong currency (e.g. “Pay with SOL”) instead of the selected token.**

---

## 2. Admin back-end (payment methods and coupons)

### 2.1 Payment method settings (already covered)

- **`src/lib/payment-method-settings.ts`** — adding the method to `PAYMENT_METHOD_DEFAULTS` (see 1.1) is enough for the admin payment methods page. The admin API **GET /api/admin/payment-methods** merges that list with the DB and **inserts any missing method with `enabled: false`**, so new methods appear in admin but are disabled until you turn them on.

### 2.2 Coupon / discount payment restriction

- **`admin/src/app/(admin)/coupons/create/page.tsx`**
  - In **PAYMENT_METHOD_OPTIONS**, add `{ key: "crypto_seeker", label: "Seeker (SKR)" }` (same `key` as `methodKey` in `PAYMENT_METHOD_DEFAULTS`).

- **`admin/src/app/(admin)/coupons/[id]/page.tsx`**
  - Add the same entry to **PAYMENT_METHOD_OPTIONS** so existing coupons can be edited with the new payment restriction.

Admin uses this list for the “Payment method restriction” dropdown when creating or editing automatic discounts (e.g. “20% off eSIM when paying with CULT”). The stored value is matched against the `paymentMethodKey` sent by checkout and eSIM purchase.

---

## 3. Footer

- **`src/ui/components/footer/FooterPaymentsBar.tsx`** uses **`getFooterPaymentItems(visibility)`** from `src/lib/checkout-payment-options.ts`. Once the new method is in **PaymentVisibility** and in **getFooterPaymentItems** (see 1.1), the footer will show its icon when the method is enabled. No change is required in the footer component itself.

---

## 4. Activating the payment method

1. **Deploy** the code (with the new method in `PAYMENT_METHOD_DEFAULTS` and all front-end and eSIM steps above). The first time an admin user opens **Payment methods**, the new method is **inserted with `enabled: false`**.
2. In the admin dashboard, go to **Payment methods** (or **Site Settings** → Payment methods, depending on your menu).
3. Find the new method (e.g. “Seeker (SKR)”) and **toggle it on**.
4. Save. The storefront will then show the new option in main checkout, on the eSIM product page (if wired in 1.7), and in the footer.

---

## Checklist summary

| Area | File(s) | What to add |
|------|--------|-------------|
| Registry | `src/lib/payment-method-settings.ts` | Entry in `PAYMENT_METHOD_DEFAULTS` |
| Visibility & options | `src/lib/checkout-payment-options.ts` | PaymentVisibility, METHOD_KEY_MAP, CRYPTO_SUB_OPTIONS, visibleCryptoSubFromVisibility, hasAnyCryptoEnabled, getFooterPaymentItems, getPaymentOptionsForDisplay (and icons if needed) |
| Main checkout key & token | `src/app/checkout/components/PaymentMethodSelector.tsx` | **paymentMethodKey useMemo**: sub → key; **handleGoToCryptoPay**: token for create-order; isSolanaPaySupported; button label; **cryptoTotalLabel** (Order summary + mobile bar); cryptoRowIcons |
| Payment constants | `src/app/checkout/checkout-payment-constants.ts` | Option value/label and icon path |
| Crypto pay client | `src/app/checkout/crypto/CryptoPayClient.tsx` | Token, labels, icons, price, create-order payload |
| Create-order API | e.g. `src/app/api/checkout/solana-pay/create-order/route.ts` | **SOLANA_TOKEN_TO_CURRENCY** (token → cryptoCurrency) and **TOKEN_TO_PAYMENT_METHOD_KEY** (token → payment method key) |
| Order fetch API | `src/app/api/checkout/orders/[orderId]/route.ts` | **SOLANA_CURRENCY_TO_TOKEN**: e.g. `SKR: "seeker"` so payment page shows correct token |
| Prices API | `src/app/api/crypto/prices/route.ts` | Price fetch and response key (if applicable) |
| **eSIM product page** | **`src/app/esim/[packageId]/esim-package-detail-client.tsx`** | **CryptoSub** type; **resolvedPayment** branch (token); **paymentMethodKey** map (for discount preview); **PAYMENT_METHOD_KEY_MAP** in handlePurchase (for `/api/esim/purchase`) |
| **eSIM crypto-checkout API** | **`src/app/api/esim/crypto-checkout/route.ts`** | **token → cryptoCurrency** in the Solana Pay branch (e.g. `cult` → `"CULT"`) so the payment page shows the correct token |
| Admin coupons | `admin/.../coupons/create/page.tsx`, `admin/.../coupons/[id]/page.tsx` | Entry in **PAYMENT_METHOD_OPTIONS** (same key as methodKey) |
| Footer | Handled via `getFooterPaymentItems` in checkout-payment-options | No separate footer file change |
| Activation | Admin UI | Enable the method in Payment methods |

New methods are inserted **disabled** so they do not appear to customers until you enable them in admin.

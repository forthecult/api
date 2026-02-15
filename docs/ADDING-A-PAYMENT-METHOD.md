# Adding a New Payment Method

This guide covers adding a new payment option (e.g. a new cryptocurrency) so it appears in checkout, admin, and footer. **New methods are inserted in disabled mode** so they do not appear to customers until you enable them in Admin → Payment methods.

---

## 1. Customer front-end (checkout and product page)

### 1.1 Payment method registry and visibility

- **`src/lib/payment-method-settings.ts`**
  - Add an entry to `PAYMENT_METHOD_DEFAULTS`:
    - `methodKey`: e.g. `"crypto_seeker"` (used in DB and API).
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

### 1.2 Checkout payment section

- **`src/app/checkout/components/PaymentMethodSection.tsx`**
  - **Payment method key (useEffect)**: when `paymentMethod === "crypto"` and the user selects the new option, set the key passed to the parent, e.g. `else if (sub === "seeker") key = "crypto_seeker"`.
  - **Supported flag**: add the new option to the condition that determines whether the “Pay with …” button is shown (e.g. for Solana Pay: `(paymentMethod === "crypto" && paymentSubOption === "seeker")` in `isSolanaPaySupported`).
  - **Pay button label**: in the branch that renders the main pay button (e.g. Solana Pay), add a label for the new option, e.g. `: paymentMethod === "crypto" && paymentSubOption === "seeker" ? "Pay with Seeker (SKR)" : ...`.
  - **Crypto total label (optional)**: if the order total should be shown in the new token (e.g. “≈ 123 SKR”), add a case in the `cryptoTotalLabel` useMemo: fetch price from your prices API, then `return \`≈ ${formatCrypto(amount, 6)} SKR\``. Add the price key to the `cryptoPrices` state type and to the fetch callback type.
  - **Crypto row icons**: in the `cryptoRowIcons` useMemo, add e.g. `if (visibility.cryptoSeeker) icons.push({ alt: "Seeker (SKR)", src: "/crypto/seeker/..." })`.

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
  - Map the token to the payment method key stored on the order, e.g. `seeker: "crypto_seeker"`, so coupons and reporting use the correct method.

### 1.5 Crypto prices (if the new token has a USD price)

- **`src/app/api/crypto/prices/route.ts`**
  - Add the token to the response type and fetch its price (e.g. from CoinGecko or another provider).
  - Add a fallback price in `FALLBACK_PRICES` if desired.

---

## 2. Admin back-end (payment methods and coupons)

### 2.1 Payment method settings (already covered)

- **`src/lib/payment-method-settings.ts`** — adding the method to `PAYMENT_METHOD_DEFAULTS` (see 1.1) is enough for the admin payment methods page. The admin API **GET /api/admin/payment-methods** merges that list with the DB and **inserts any missing method with `enabled: false`**, so new methods appear in admin but are disabled until you turn them on.

### 2.2 Coupon / discount payment restriction

- **`admin/src/app/(admin)/coupons/create/page.tsx`**
  - In **PAYMENT_METHOD_OPTIONS**, add `{ key: "crypto_seeker", label: "Seeker (SKR)" }` (same `key` as `methodKey` in `PAYMENT_METHOD_DEFAULTS`).

- **`admin/src/app/(admin)/coupons/[id]/page.tsx`**
  - Add the same entry to **PAYMENT_METHOD_OPTIONS** so existing coupons can be edited with the new payment restriction.

---

## 3. Footer

- **`src/ui/components/footer/FooterPaymentsBar.tsx`** uses **`getFooterPaymentItems(visibility)`** from `src/lib/checkout-payment-options.ts`. Once the new method is in **PaymentVisibility** and in **getFooterPaymentItems** (see 1.1), the footer will show its icon when the method is enabled. No change is required in the footer component itself.

---

## 4. Activating the payment method

1. **Deploy** the code (with the new method in `PAYMENT_METHOD_DEFAULTS` and all front-end/admin steps above). The first time an admin user opens **Payment methods**, the new method is **inserted with `enabled: false`**.
2. In the admin dashboard, go to **Payment methods** (or **Site Settings** → Payment methods, depending on your menu).
3. Find the new method (e.g. “Seeker (SKR)”) and **toggle it on**.
4. Save. The storefront will then show the new option in checkout and in the footer (and on the product page if you wired it there).

---

## Checklist summary

| Area | File(s) | What to add |
|------|--------|-------------|
| Registry | `src/lib/payment-method-settings.ts` | Entry in `PAYMENT_METHOD_DEFAULTS` |
| Visibility & options | `src/lib/checkout-payment-options.ts` | PaymentVisibility, METHOD_KEY_MAP, CRYPTO_SUB_OPTIONS, visibleCryptoSubFromVisibility, hasAnyCryptoEnabled, getFooterPaymentItems, getPaymentOptionsForDisplay (and icons if needed) |
| Checkout section | `src/app/checkout/components/PaymentMethodSection.tsx` | Key mapping, isSolanaPaySupported (or other branch), button label, cryptoTotalLabel, cryptoRowIcons |
| Payment constants | `src/app/checkout/checkout-payment-constants.ts` | Option value/label and icon path |
| Crypto pay client | `src/app/checkout/crypto/CryptoPayClient.tsx` | Token, labels, icons, price, create-order payload |
| Create-order API | e.g. `src/app/api/checkout/solana-pay/create-order/route.ts` | Token → payment method key |
| Prices API | `src/app/api/crypto/prices/route.ts` | Price fetch and response key (if applicable) |
| Admin coupons | `admin/.../coupons/create/page.tsx`, `admin/.../coupons/[id]/page.tsx` | Entry in `PAYMENT_METHOD_OPTIONS` |
| Footer | Handled via `getFooterPaymentItems` in checkout-payment-options | No separate footer file change |
| Activation | Admin UI | Enable the method in Payment methods |

New methods are inserted **disabled** so they do not appear to customers until you enable them in admin.

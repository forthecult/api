# Checkout refactor

Checkout was split from a single 3,500+ line component into smaller pieces for performance and maintainability.

## Current structure

- **CheckoutClient.tsx** – Orchestrator. Holds cart, coupon state, shipping/tax totals (from callback), payment state, and Solana Pay. Coordinates validation and submit/redirect via refs to the form components.
- **checkout-shared.ts** – Shared types (`CheckoutFormState`, `BillingFormState`, `AppliedCoupon`), constants (country/state options, CSS classes, policy text), and shipping form persistence helpers.
- **components/OrderSummary.tsx** – Pure display. Receives items, totals, discount state, and callbacks; no local state.
- **components/ShippingAddressForm.tsx** – Owns shipping/contact state (form, emailNews, textNews) and runs the shipping API. Exposes `getForm()`, `getEmailNews()`, `getTextNews()`, `validate()`, `persistForm()` via ref. Notifies parent of shipping/tax via `onShippingUpdate`.
- **components/BillingAddressForm.tsx** – Owns billing state (`billingForm`, `useShippingAsBilling`). Exposes `getBilling()`, `getUseShippingAsBilling()`, `validate()` via ref. Rendered inside the Payment card when credit card is selected.
- **components/PaymentMethodSelector.tsx** – The payment card: credit card, crypto, stablecoins, PayPal, CTAs, policy links. Owns payment method state; ref exposes `triggerPay()`, `canPlaceOrder`, `getPaymentMethod()`, `validate()`, `getStripeCardRef()`. Used by CheckoutClient via **components/PaymentMethodSection.tsx**, which re-exports it for backward compatibility.

## Speed optimizations and lazy loading

Checkout and payment use **prefetch on intent** (cart open / hover checkout, payment method click), **code-splitting** (checkout and pay clients in separate chunks), and **earlier data** (one order fetch in the invoice layout, passed as `initialOrder` to pay clients).

For full detail on checkout/payment behavior and maintenance (prefetch-checkout.ts, loaders, initialOrder, new payment methods), see **[docs/SPEED-OPTIMIZATION-AND-LAZY-LOADING.md](../../../docs/SPEED-OPTIMIZATION-AND-LAZY-LOADING.md)**. That doc also covers site-wide speed optimizations (route prefetching, lazy loading, images, build config).

## Possible next steps

- **Payment card** – The Payment card lives in `PaymentMethodSelector.tsx`; `PaymentMethodSection.tsx` re-exports it. The ref already exposes `triggerPay()`, `canPlaceOrder`, `getPaymentMethod()`, `validate()` (shipping + billing), and `getStripeCardRef()` for programmatic use. Further refinements (e.g. credit-card-only validation via ref) can be added on top of this.

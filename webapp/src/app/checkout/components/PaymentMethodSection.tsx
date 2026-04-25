"use client";

/**
 * Thin wrapper for backward compatibility. The payment card UI (credit card,
 * crypto, stablecoins, PayPal, CTAs, policy links) lives in PaymentMethodSelector.
 * CheckoutClient and the dynamic import still use this file so no call-site
 * changes are required.
 */
export {
  PaymentMethodSelector as PaymentMethodSection,
  type PaymentMethodSelectorProps as PaymentMethodSectionProps,
  type PaymentMethodSelectorRef as PaymentMethodSectionRef,
} from "./PaymentMethodSelector";

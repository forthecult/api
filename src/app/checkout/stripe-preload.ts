/**
 * Shared Stripe SDK preload for checkout. Call preloadStripe() when the user
 * shows intent (e.g. hover/focus on "Credit/debit card") so the SDK is loading
 * before they click; getStripePromise() lets StripeCardPayment/ExpressCheckout
 * use the same promise and avoid a second load.
 */
import type { Stripe } from "@stripe/stripe-js";

const KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let cached: null | Promise<null | Stripe> = null;

export function getStripePromise(): null | Promise<null | Stripe> {
  return cached;
}

export function preloadStripe(): void {
  if (cached || !KEY) return;
  cached = import("@stripe/stripe-js").then(({ loadStripe }) =>
    loadStripe(KEY),
  );
}

export function setStripePromiseFromLoad(p: Promise<null | Stripe>): void {
  if (!cached) cached = p;
}

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export function getStripe(): Stripe {
  if (
    !stripeSecretKey ||
    stripeSecretKey === "" ||
    stripeSecretKey.startsWith("sk_") === false
  ) {
    throw new Error("STRIPE_SECRET_KEY is not set or invalid");
  }
  return new Stripe(stripeSecretKey);
}

/** use when you need Stripe only if configured (e.g. optional checkout) */
export function getStripeIfConfigured(): null | Stripe {
  if (
    !stripeSecretKey ||
    stripeSecretKey === "" ||
    stripeSecretKey.startsWith("sk_") === false
  ) {
    return null;
  }
  return new Stripe(stripeSecretKey);
}

export function getStripeWebhookSecret(): string {
  if (!stripeWebhookSecret || stripeWebhookSecret === "") {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return stripeWebhookSecret;
}

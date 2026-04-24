import { preconnect, prefetchDNS } from "react-dom";

import { SEO_CONFIG } from "~/app";

import { CheckoutLoader } from "./checkout-loader";

export const metadata = {
  description: "Review your cart and proceed to payment.",
  title: `Checkout | ${SEO_CONFIG.name}`,
};

export default function CheckoutPage() {
  // React 19 resource-preload APIs. Stripe (card/express) and the SideShift
  // widget (dev-only swap) are *only* used on checkout, but we used to
  // advertise them in a `Link: preconnect` header on every page — wasted
  // handshake budget for users who never hit /checkout. Moving the hint here
  // means every other route's critical path stays lean while the checkout
  // itself still establishes the TLS connection before the Stripe SDK chunk
  // has finished downloading.
  preconnect("https://js.stripe.com");
  prefetchDNS("https://api.stripe.com");
  prefetchDNS("https://sideshift.ai");

  return (
    <div
      className={`
        container mx-auto py-8
        md:py-10
      `}
    >
      <CheckoutLoader />
    </div>
  );
}

import { SEO_CONFIG } from "~/app";

import { CheckoutLoader } from "./checkout-loader";

export const metadata = {
  description: "Review your cart and proceed to payment.",
  title: `Checkout | ${SEO_CONFIG.name}`,
};

export default function CheckoutPage() {
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

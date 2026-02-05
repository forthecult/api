import { SEO_CONFIG } from "~/app";

import { SuccessPageClient } from "./success-page-client";

export const metadata = {
  description: "Thank you for your order.",
  title: `Order confirmed | ${SEO_CONFIG.name}`,
};

export default function CheckoutSuccessPage() {
  return <SuccessPageClient />;
}

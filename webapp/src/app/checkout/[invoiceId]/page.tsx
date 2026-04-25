import { SEO_CONFIG } from "~/app";

import { CryptoPayLoader } from "./crypto-pay-loader";

export const metadata = {
  description: "Pay with crypto.",
  title: `Pay with crypto | ${SEO_CONFIG.name}`,
};

export default function CheckoutInvoicePage() {
  return <CryptoPayLoader />;
}

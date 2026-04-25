import { SEO_CONFIG } from "~/app";

import { EthPayPageLoader } from "./EthPayPageLoader";

export const metadata = {
  description: "Pay with Ethereum (ETH).",
  title: `Pay with ETH | ${SEO_CONFIG.name}`,
};

export default function CheckoutEthPage() {
  return <EthPayPageLoader />;
}

import type { Metadata } from "next";

import { StakerEsimTestClient } from "./staker-esim-test-client";

export const metadata: Metadata = {
  description: "Preview: eSIM claim experience after staking",
  robots: { follow: false, index: false },
  title: "Test: Staker eSIM Claim",
};

export default function TestStakerEsimPage() {
  return <StakerEsimTestClient />;
}

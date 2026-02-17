import type { Metadata } from "next";

import { MembershipAfterStakeTestClient } from "./membership-after-stake-client";

export const metadata: Metadata = {
  description: "Preview: Membership page after staking, and flow to claim eSIM",
  robots: { follow: false, index: false },
  title: "Test: Membership After Stake",
};

export default function TestMembershipAfterStakePage() {
  return <MembershipAfterStakeTestClient />;
}

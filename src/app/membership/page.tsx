import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";
import { MembershipClient } from "./membership-client";

export const metadata: Metadata = {
  title: `Join the Cult | Membership | ${SEO_CONFIG.name}`,
  description:
    "Stake CULT to unlock exclusive membership benefits. Free eSIM cards, free shipping, and member-only discounts. Stake for 12 months and get 14 months of eSIM coverage.",
};

export default function MembershipPage() {
  return <MembershipClient />;
}

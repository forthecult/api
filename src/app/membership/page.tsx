import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";

import { MembershipClient } from "./membership-client";

export const metadata: Metadata = {
  description:
    "Stake CULT to unlock exclusive membership benefits. Free eSIM cards, VPN subscription at APEX, free shipping, and member-only discounts. Stake for 12 months and get eSIM benefits for 14 months.",
  title: `Join the Cult | Membership | ${SEO_CONFIG.name}`,
};

export default function MembershipPage() {
  return <MembershipClient />;
}

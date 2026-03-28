import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

import { MembershipClient } from "./membership-client";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/membership`,
  },
  description:
    "Stake CULT to unlock exclusive membership benefits. Free eSIM cards, VPN subscription at APEX, free shipping, and member-only discounts. Stake for 12 months and get eSIM benefits for 14 months.",
  title: `Join the Cult | Membership | ${SEO_CONFIG.name}`,
};

export default function MembershipPage() {
  return <MembershipClient />;
}

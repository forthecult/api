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
    "Hold and lock CULT for member benefits — free eSIM cards, APEX VPN, free shipping, and member-only discounts. Lock for 12 months and eSIM benefits extend to 14.",
  title: `Join the Cult | Membership | ${SEO_CONFIG.name}`,
};

export default function MembershipPage() {
  return <MembershipClient />;
}

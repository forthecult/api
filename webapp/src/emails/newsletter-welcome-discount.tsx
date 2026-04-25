import { Heading, Link, Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  appendEmailUtm,
  emailUtmQueryString,
} from "~/lib/email/marketing-email-url";

export function NewsletterWelcomeDiscountEmail({
  discountCode,
  unsubscribeUrl,
}: Readonly<{ discountCode: string; unsubscribeUrl: string }>) {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const shop = `${base}/shop`;
  const campaign = "newsletter_welcome";
  const shopCta = appendEmailUtm(shop, campaign, "cta_shop");
  const heroHref = appendEmailUtm(shop, campaign, "hero_banner");
  const videoHref = appendEmailUtm(shop, campaign, "video_spotlight");
  const utmFooterQuery = emailUtmQueryString(campaign, "footer_links");

  return (
    <EmailShell
      marketingHeroHref={heroHref}
      preview="Your welcome code — Culture"
      showBrandStoryFooter
      showMarketingCompliance
      showMarketingHero
      utmFooterQuery={utmFooterQuery}
      videoSpotlight={{
        href: videoHref,
        label: "See what we stock",
      }}
    >
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "22px", margin: "0 0 12px" }}
      >
        You&apos;re on the list
      </Heading>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 8px" }}>
        First order — use this code at checkout:
      </Text>
      <Text
        style={{
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          margin: "16px 0",
          padding: "16px",
          textAlign: "center",
        }}
      >
        {discountCode}
      </Text>
      <Text style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px" }}>
        Exclusions may apply. Code is for marketing subscribers.
      </Text>
      <CtaButton href={shopCta} label="Shop now" variant="brand" />
      <Text
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.5,
          margin: "24px 0 0",
          textAlign: "center",
        }}
      >
        Unsubscribe from newsletter emails:{" "}
        <Link href={unsubscribeUrl} style={{ color: "#64748b" }}>
          Unsubscribe
        </Link>
      </Text>
    </EmailShell>
  );
}

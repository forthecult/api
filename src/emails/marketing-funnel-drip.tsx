import { Heading, Link, Text } from "@react-email/components";

import { CtaButton, type EmailProductPick, EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  appendEmailUtm,
  emailUtmQueryString,
} from "~/lib/email/marketing-email-url";

export function MarketingFunnelDripEmail({
  bodyLines,
  couponCode,
  headline,
  picksSubtitle,
  preview,
  primaryCtaHref,
  primaryCtaLabel,
  productPicks,
  utmCampaign = "email_funnel",
  utmContent = "drip",
  videoLabel = "Spotlight: shop preview",
}: Readonly<{
  bodyLines: readonly string[];
  couponCode?: string;
  headline: string;
  picksSubtitle?: string;
  preview: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  productPicks?: readonly EmailProductPick[];
  utmCampaign?: string;
  utmContent?: string;
  videoLabel?: string;
}>) {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const banner = couponCode
    ? `Your code: ${couponCode} — enter it at checkout. One use per customer unless noted in admin.`
    : undefined;

  const taggedPrimary = appendEmailUtm(primaryCtaHref, utmCampaign, utmContent);
  const heroHref = appendEmailUtm(primaryCtaHref, utmCampaign, "hero_banner");
  const videoHref = appendEmailUtm(
    `${base}/shop`,
    utmCampaign,
    "video_spotlight",
  );
  const utmFooterQuery = emailUtmQueryString(utmCampaign, "footer_links");
  const utmProductQuery = emailUtmQueryString(utmCampaign, "product_recs");

  return (
    <EmailShell
      couponBanner={banner}
      marketingHeroHref={heroHref}
      picksSubtitle={
        picksSubtitle ?? "You might be interested in these products"
      }
      preview={preview}
      productPicks={productPicks}
      showBrandStoryFooter
      showMarketingCompliance
      showMarketingHero
      utmFooterQuery={utmFooterQuery}
      utmProductQuery={utmProductQuery}
      videoSpotlight={{
        href: videoHref,
        label: videoLabel,
      }}
    >
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "22px", margin: "0 0 14px" }}
      >
        {headline}
      </Heading>
      {bodyLines.map((line, i) => (
        <Text
          key={i}
          style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 10px" }}
        >
          {line}
        </Text>
      ))}
      <CtaButton href={taggedPrimary} label={primaryCtaLabel} variant="brand" />
      <Text
        style={{
          color: "#64748b",
          fontSize: "13px",
          lineHeight: 1.7,
          margin: "16px 0 0",
        }}
      >
        <Link
          href={appendEmailUtm(`${base}/shop`, utmCampaign, "nav_shop")}
          style={{ color: "#0f172a" }}
        >
          Shop
        </Link>
        {" · "}
        <Link
          href={appendEmailUtm(
            `${base}/membership`,
            utmCampaign,
            "nav_membership",
          )}
          style={{ color: "#0f172a" }}
        >
          Membership
        </Link>
        {" · "}
        <Link
          href={appendEmailUtm(`${base}/services`, utmCampaign, "nav_services")}
          style={{ color: "#0f172a" }}
        >
          Services
        </Link>
      </Text>
    </EmailShell>
  );
}

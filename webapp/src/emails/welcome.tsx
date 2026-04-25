import { Heading, Text } from "@react-email/components";

import { CtaButton, type EmailProductPick, EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  appendEmailUtm,
  emailUtmQueryString,
} from "~/lib/email/marketing-email-url";

export function WelcomeEmail({
  bodyText,
  productPicks,
  userName,
}: Readonly<{
  bodyText: string;
  productPicks?: readonly EmailProductPick[];
  userName: string;
}>) {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const shop = `${base}/shop`;
  const campaign = "welcome_email";
  const shopCta = appendEmailUtm(shop, campaign, "cta_shop");
  const heroHref = appendEmailUtm(shop, campaign, "hero_banner");
  const videoHref = appendEmailUtm(shop, campaign, "video_spotlight");
  const utmFooterQuery = emailUtmQueryString(campaign, "footer_links");
  const utmProductQuery = emailUtmQueryString(campaign, "product_recs");

  return (
    <EmailShell
      marketingHeroHref={heroHref}
      picksSubtitle="Popular right now on Culture"
      preview="You're in — Culture"
      productPicks={productPicks}
      showBrandStoryFooter
      showMarketingCompliance
      showMarketingHero
      utmFooterQuery={utmFooterQuery}
      utmProductQuery={utmProductQuery}
      videoSpotlight={{
        href: videoHref,
        label: "Browse the catalog",
      }}
    >
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "24px", margin: "0 0 16px" }}
      >
        Welcome, {userName}!
      </Heading>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
        {bodyText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
      <CtaButton href={shopCta} label="Start shopping" variant="brand" />
      <Text style={{ color: "#64748b", fontSize: "14px", margin: "16px 0 0" }}>
        Thanks for joining us.
      </Text>
    </EmailShell>
  );
}

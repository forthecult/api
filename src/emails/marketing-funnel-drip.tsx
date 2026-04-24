import { Heading, Link, Text } from "@react-email/components";

import { type EmailProductPick, EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";

export function MarketingFunnelDripEmail({
  bodyLines,
  couponCode,
  headline,
  preview,
  primaryCtaHref,
  primaryCtaLabel,
  productPicks,
  picksSubtitle,
}: Readonly<{
  bodyLines: readonly string[];
  couponCode?: string;
  headline: string;
  preview: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  productPicks?: readonly EmailProductPick[];
  picksSubtitle?: string;
}>) {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const banner =
    couponCode ?
      `Your code: ${couponCode} — enter it at checkout. One use per customer unless noted in admin.`
    : undefined;

  return (
    <EmailShell
      couponBanner={banner}
      picksSubtitle={picksSubtitle ?? "You might be interested in these products"}
      preview={preview}
      productPicks={productPicks}
      showBrandStoryFooter
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
      <Text style={{ margin: "16px 0 8px" }}>
        <Link
          href={primaryCtaHref}
          style={{
            backgroundColor: "#0f172a",
            borderRadius: "8px",
            color: "#ffffff",
            display: "inline-block",
            fontWeight: 600,
            padding: "12px 24px",
            textDecoration: "none",
          }}
        >
          {primaryCtaLabel}
        </Link>
      </Text>
      <Text style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.7, margin: "16px 0 0" }}>
        <Link href={`${base}/shop`} style={{ color: "#0f172a" }}>
          Shop
        </Link>
        {" · "}
        <Link href={`${base}/membership`} style={{ color: "#0f172a" }}>
          Membership
        </Link>
        {" · "}
        <Link href={`${base}/services`} style={{ color: "#0f172a" }}>
          Services
        </Link>
      </Text>
    </EmailShell>
  );
}

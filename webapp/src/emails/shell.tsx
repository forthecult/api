import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { getPublicSiteUrl } from "~/lib/app-url";

export const EMAIL_MARKETING_HERO_PATH = "/email/marketing-hero.jpg";
export const EMAIL_MARKETING_VIDEO_THUMB_PATH = "/email/email-video-thumb.jpg";

export interface EmailProductPick {
  href: string;
  imageUrl: string;
  name: string;
  priceLabel: string;
}

const ctaStyleDefault = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block" as const,
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none" as const,
};

/** Brand accent (amber) — use for marketing / lifecycle promo CTAs. */
const ctaStyleBrand = {
  backgroundColor: "#C4873A",
  borderRadius: "8px",
  color: "#111111",
  display: "inline-block" as const,
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none" as const,
};

export function CtaButton({
  href,
  label,
  variant = "default",
}: Readonly<{ href: string; label: string; variant?: "brand" | "default" }>) {
  const style = variant === "brand" ? ctaStyleBrand : ctaStyleDefault;
  return (
    <Section style={{ marginTop: "24px", textAlign: "left" }}>
      <Link href={href} style={style}>
        {label}
      </Link>
    </Section>
  );
}

export function EmailShell({
  children,
  couponBanner,
  marketingHeroHref,
  picksSubtitle = "You might be interested in these picks",
  preview,
  productPicks,
  showBrandStoryFooter = false,
  showMarketingCompliance = false,
  showMarketingHero = false,
  siteName = "For the Culture",
  utmFooterQuery,
  utmProductQuery,
  videoSpotlight,
}: Readonly<{
  children: React.ReactNode;
  couponBanner?: string;
  marketingHeroHref?: string;
  picksSubtitle?: string;
  preview?: string;
  productPicks?: readonly EmailProductPick[];
  showBrandStoryFooter?: boolean;
  showMarketingCompliance?: boolean;
  showMarketingHero?: boolean;
  siteName?: string;
  utmFooterQuery?: string;
  utmProductQuery?: string;
  videoSpotlight?: Readonly<{ href: string; label: string }>;
}>) {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  return (
    <Html lang="en">
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body
        style={{
          backgroundColor: "#f1f5f9",
          color: "#334155",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container style={{ margin: "0 auto", maxWidth: "560px" }}>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              overflow: "hidden",
              padding: "24px",
            }}
          >
            <Text
              style={{
                color: "#0f172a",
                fontSize: "20px",
                fontWeight: 700,
                margin: "0 0 20px",
              }}
            >
              {siteName}
            </Text>
            {showMarketingHero ? (
              <MarketingHeroBanner
                alt="Culture — curated commerce"
                base={base}
                href={marketingHeroHref}
              />
            ) : null}
            {children}
            {videoSpotlight ? (
              <VideoSpotlightBlock
                base={base}
                href={videoSpotlight.href}
                label={videoSpotlight.label}
              />
            ) : null}
            {couponBanner ? (
              <Section
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  marginTop: "20px",
                  padding: "14px 16px",
                }}
              >
                <Text
                  style={{
                    color: "#0f172a",
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {couponBanner}
                </Text>
              </Section>
            ) : null}
            {productPicks && productPicks.length > 0 ? (
              <ProductPicksSection
                products={productPicks}
                title={picksSubtitle}
                utmQuery={utmProductQuery ?? utmFooterQuery}
              />
            ) : null}
            {showBrandStoryFooter ? (
              <BrandMarketingFooter
                base={base}
                utmFooterQuery={utmFooterQuery}
              />
            ) : null}
          </Section>
          <Section style={{ padding: "20px 8px 0" }}>
            <Text
              style={{
                color: "#64748b",
                fontSize: "13px",
                lineHeight: 1.5,
                margin: 0,
                textAlign: "center",
              }}
            >
              Questions? Reply to this email or visit{" "}
              <Link href={base} style={{ color: "#0f172a" }}>
                {base.replace(/^https?:\/\//u, "")}
              </Link>
            </Text>
            {showMarketingCompliance ? (
              <MarketingComplianceFooter base={base} />
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function BrandMarketingFooter({
  base,
  utmFooterQuery,
}: Readonly<{ base: string; utmFooterQuery?: string }>) {
  const withUtm = (path: string) => {
    const q = utmFooterQuery?.trim();
    if (!q) return path;
    return path.includes("?") ? `${path}&${q}` : `${path}?${q}`;
  };
  return (
    <Section style={{ marginTop: "28px" }}>
      <Hr style={{ borderColor: "#e2e8f0", margin: "0 0 20px" }} />
      <Text
        style={{
          color: "#0f172a",
          fontSize: "15px",
          fontWeight: 700,
          margin: "0 0 8px",
        }}
      >
        For the Culture
      </Text>
      <Text
        style={{
          color: "#475569",
          fontSize: "14px",
          lineHeight: 1.6,
          margin: "0 0 16px",
        }}
      >
        Curated gear and services — pay your way. More stories in your inbox
        soon.
      </Text>
      <Text style={{ fontSize: "14px", lineHeight: 1.8, margin: 0 }}>
        <Link
          href={withUtm(`${base}/shop`)}
          style={{ color: "#0f172a", fontWeight: 600 }}
        >
          Shop all
        </Link>
        {" · "}
        <Link
          href={withUtm(`${base}/services`)}
          style={{ color: "#0f172a", fontWeight: 600 }}
        >
          Services
        </Link>
        {" · "}
        <Link
          href={withUtm(`${base}/membership`)}
          style={{ color: "#0f172a", fontWeight: 600 }}
        >
          Membership
        </Link>
        {" · "}
        <Link
          href={withUtm(`${base}/open-source`)}
          style={{ color: "#0f172a", fontWeight: 600 }}
        >
          Open source
        </Link>
      </Text>
    </Section>
  );
}

function MarketingComplianceFooter({ base }: Readonly<{ base: string }>) {
  const postal =
    typeof process !== "undefined"
      ? process.env.EMAIL_POSTAL_ADDRESS?.trim()
      : undefined;
  const host = base.replace(/^https?:\/\//u, "");
  return (
    <Section style={{ marginTop: "20px" }}>
      <Text
        style={{
          color: "#94a3b8",
          fontSize: "11px",
          lineHeight: 1.6,
          margin: 0,
          textAlign: "center",
        }}
      >
        You are receiving this because you opted in at {host}.
        {postal ? ` ${postal}` : ""}
      </Text>
    </Section>
  );
}

function MarketingHeroBanner({
  alt,
  base,
  href,
}: Readonly<{ alt: string; base: string; href?: string }>) {
  const src = `${base}${EMAIL_MARKETING_HERO_PATH}`;
  const img = (
    <Img
      alt={alt}
      height={200}
      src={src}
      style={{
        borderRadius: "10px",
        display: "block",
        height: "auto",
        maxWidth: "100%",
      }}
      width={600}
    />
  );
  return (
    <Section style={{ margin: "0 0 20px" }}>
      {href ? (
        <Link href={href} style={{ textDecoration: "none" }}>
          {img}
        </Link>
      ) : (
        img
      )}
    </Section>
  );
}

function pickHrefWithUtm(href: string, utmQuery?: string): string {
  const q = utmQuery?.trim();
  if (!q) return href;
  try {
    const u = new URL(href);
    if (u.pathname.startsWith("/api/")) return href;
    if (/[?&]token=/i.test(u.search)) return href;
    return href.includes("?") ? `${href}&${q}` : `${href}?${q}`;
  } catch {
    return href;
  }
}

function ProductPicksSection({
  products,
  title,
  utmQuery,
}: Readonly<{
  products: readonly EmailProductPick[];
  title: string;
  utmQuery?: string;
}>) {
  if (products.length === 0) return null;
  return (
    <Section style={{ marginTop: "28px" }}>
      <Text
        style={{
          color: "#0f172a",
          fontSize: "18px",
          fontWeight: 700,
          margin: "0 0 12px",
        }}
      >
        {title}
      </Text>
      <Row>
        {products.slice(0, 4).map((p) => (
          <Column
            key={p.href}
            style={{ padding: "4px", verticalAlign: "top", width: "50%" }}
          >
            <Link
              href={pickHrefWithUtm(p.href, utmQuery)}
              style={{ textDecoration: "none" }}
            >
              {p.imageUrl ? (
                <Img
                  alt={p.name}
                  height={140}
                  src={p.imageUrl}
                  style={{
                    borderRadius: "8px",
                    display: "block",
                    height: "auto",
                    maxWidth: "100%",
                  }}
                  width={248}
                />
              ) : null}
              <Text
                style={{
                  color: "#0f172a",
                  fontSize: "14px",
                  fontWeight: 600,
                  margin: "8px 0 2px",
                }}
              >
                {p.name}
              </Text>
              <Text style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
                {p.priceLabel}
              </Text>
            </Link>
          </Column>
        ))}
      </Row>
    </Section>
  );
}

function VideoSpotlightBlock({
  base,
  href,
  label,
}: Readonly<{ base: string; href: string; label: string }>) {
  const thumb = `${base}${EMAIL_MARKETING_VIDEO_THUMB_PATH}`;
  return (
    <Section style={{ marginTop: "24px" }}>
      <Text
        style={{
          color: "#0f172a",
          fontSize: "15px",
          fontWeight: 700,
          margin: "0 0 10px",
        }}
      >
        {label}
      </Text>
      <Link href={href} style={{ textDecoration: "none" }}>
        <Img
          alt="Shop preview"
          height={315}
          src={thumb}
          style={{
            borderRadius: "10px",
            display: "block",
            height: "auto",
            maxWidth: "100%",
          }}
          width={560}
        />
      </Link>
      <Text style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 0" }}>
        Tap the image — opens on our site.
      </Text>
    </Section>
  );
}

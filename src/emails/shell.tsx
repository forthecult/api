import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Hr,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { getPublicSiteUrl } from "~/lib/app-url";

export interface EmailProductPick {
  href: string;
  imageUrl: string;
  name: string;
  priceLabel: string;
}

export function CtaButton({
  href,
  label,
}: Readonly<{ href: string; label: string }>) {
  return (
    <Section style={{ marginTop: "24px", textAlign: "left" }}>
      <Link
        href={href}
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
        {label}
      </Link>
    </Section>
  );
}

function ProductPicksSection({
  products,
  title,
}: Readonly<{
  products: readonly EmailProductPick[];
  title: string;
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
            <Link href={p.href} style={{ textDecoration: "none" }}>
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

function BrandMarketingFooter({ base }: Readonly<{ base: string }>) {
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
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px" }}>
        Culture is longevity-first commerce — curated gear, membership perks, and checkout that
        respects how you pay (card, crypto, and more). Every order supports independent creators and
        quality-first fulfillment partners.
      </Text>
      <Text style={{ fontSize: "14px", lineHeight: 1.8, margin: 0 }}>
        <Link href={`${base}/shop`} style={{ color: "#0f172a", fontWeight: 600 }}>
          Shop all
        </Link>
        {" · "}
        <Link href={`${base}/services`} style={{ color: "#0f172a", fontWeight: 600 }}>
          Services
        </Link>
        {" · "}
        <Link href={`${base}/membership`} style={{ color: "#0f172a", fontWeight: 600 }}>
          Membership
        </Link>
        {" · "}
        <Link href={`${base}/open-source`} style={{ color: "#0f172a", fontWeight: 600 }}>
          Open source
        </Link>
      </Text>
    </Section>
  );
}

export function EmailShell({
  children,
  couponBanner,
  picksSubtitle = "You might be interested in these picks",
  preview,
  productPicks,
  showBrandStoryFooter = false,
  siteName = "For the Culture",
}: Readonly<{
  children: React.ReactNode;
  couponBanner?: string;
  picksSubtitle?: string;
  preview?: string;
  productPicks?: readonly EmailProductPick[];
  showBrandStoryFooter?: boolean;
  siteName?: string;
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
            {children}
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
              <ProductPicksSection products={productPicks} title={picksSubtitle} />
            ) : null}
            {showBrandStoryFooter ? <BrandMarketingFooter base={base} /> : null}
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
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

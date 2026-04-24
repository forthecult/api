import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { getPublicSiteUrl } from "~/lib/app-url";

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

export function EmailShell({
  children,
  preview,
  siteName = "For the Culture",
}: Readonly<{
  children: React.ReactNode;
  preview?: string;
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

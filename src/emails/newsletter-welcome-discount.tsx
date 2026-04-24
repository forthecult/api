import { Heading, Link, Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";

export function NewsletterWelcomeDiscountEmail({
  discountCode,
  unsubscribeUrl,
}: Readonly<{ discountCode: string; unsubscribeUrl: string }>) {
  const shop = `${getPublicSiteUrl().replace(/\/$/, "")}/shop`;
  return (
    <EmailShell preview="Thanks for subscribing">
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "22px", margin: "0 0 12px" }}
      >
        You&apos;re on the list
      </Heading>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 12px" }}>
        Here&apos;s your welcome code for your first order:
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
        Enter this code at checkout. Exclusions may apply.
      </Text>
      <CtaButton href={shop} label="Shop now" />
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

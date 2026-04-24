import { Heading, Link, Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";
import { getPublicSiteUrl } from "~/lib/app-url";

export function WelcomeEmail({
  bodyText,
  userName,
}: Readonly<{ bodyText: string; userName: string }>) {
  const shop = `${getPublicSiteUrl().replace(/\/$/, "")}/shop`;
  return (
    <EmailShell preview="You're in">
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
      <Text style={{ margin: "0 0 16px" }}>
        <Link
          href={shop}
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
          Start shopping
        </Link>
      </Text>
      <Text style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
        Thanks for joining us.
      </Text>
    </EmailShell>
  );
}

import { Heading, Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";

export function AddEmailCodeEmail({
  appName,
  code,
}: Readonly<{ appName: string; code: string }>) {
  return (
    <EmailShell preview="Verify your email" siteName={appName}>
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "22px", margin: "0 0 12px" }}
      >
        Verify your email
      </Heading>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
        You requested to add this email to your account. Use this code to verify
        you own this address:
      </Text>
      <Text
        style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          margin: "16px 0",
        }}
      >
        {code}
      </Text>
      <Text style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
        This code expires in 10 minutes. If you didn&apos;t request this, you
        can ignore this email.
      </Text>
    </EmailShell>
  );
}

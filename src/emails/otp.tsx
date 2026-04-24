import { Heading, Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";

export function OtpEmail({
  appName,
  otp,
  purposeLine,
}: Readonly<{ appName: string; otp: string; purposeLine: string }>) {
  return (
    <EmailShell preview="Your verification code" siteName={appName}>
      <Heading
        as="h1"
        style={{ color: "#0f172a", fontSize: "22px", margin: "0 0 12px" }}
      >
        Your verification code
      </Heading>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
        {purposeLine}
      </Text>
      <Text
        style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          margin: "16px 0",
        }}
      >
        {otp}
      </Text>
      <Text style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
        This code expires in a few minutes. If you didn&apos;t request this, you
        can ignore this email.
      </Text>
    </EmailShell>
  );
}

import { Link, Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";

export function PasswordResetEmail({
  resetUrl,
}: Readonly<{ resetUrl: string }>) {
  return (
    <EmailShell preview="Reset your password">
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
        Click the button below to set a new password. This link expires in 1
        hour.
      </Text>
      <Text style={{ margin: "0 0 16px" }}>
        <Link
          href={resetUrl}
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
          Reset password
        </Link>
      </Text>
      <Text style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
        If you didn&apos;t request this, you can ignore this email.
      </Text>
    </EmailShell>
  );
}

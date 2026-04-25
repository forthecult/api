import { Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";

export function NewsletterConfirmEmail({
  confirmUrl,
}: Readonly<{ confirmUrl: string }>) {
  return (
    <EmailShell preview="Confirm your newsletter subscription">
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
        You&apos;re one click away from confirming your subscription to our
        newsletter and occasional product updates.
      </Text>
      <CtaButton href={confirmUrl} label="Confirm subscription" />
      <Text style={{ color: "#64748b", fontSize: "13px", margin: "16px 0 0" }}>
        If you didn&apos;t sign up, you can ignore this email.
      </Text>
    </EmailShell>
  );
}

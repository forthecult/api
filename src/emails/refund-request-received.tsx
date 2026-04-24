import { Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";

export function RefundRequestReceivedEmail({
  bodyText,
  ctaUrl,
}: Readonly<{ bodyText: string; ctaUrl: string }>) {
  return (
    <EmailShell preview="Refund request received">
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 12px" }}>
        {bodyText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
      <CtaButton href={ctaUrl} label="Refund status" />
    </EmailShell>
  );
}

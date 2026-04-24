import { Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";

export function SupportTicketReplyEmail({
  bodyText,
  ctaUrl,
  subjectLine,
}: Readonly<{
  bodyText: string;
  ctaUrl: string;
  subjectLine: string;
}>) {
  return (
    <EmailShell preview="New reply on your support ticket">
      <Text style={{ color: "#64748b", fontSize: "14px", margin: "0 0 8px" }}>
        Ticket: {subjectLine}
      </Text>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 12px" }}>
        {bodyText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
      <CtaButton href={ctaUrl} label="View ticket" />
    </EmailShell>
  );
}

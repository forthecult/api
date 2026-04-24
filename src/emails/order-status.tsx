import { Text } from "@react-email/components";

import { CtaButton, EmailShell } from "~/emails/shell";

/** order_processing | order_on_hold | order_cancelled */
export function OrderStatusEmail({
  bodyText,
  ctaLabel,
  ctaUrl,
  preview,
}: Readonly<{
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  preview: string;
}>) {
  return (
    <EmailShell preview={preview}>
      <Text style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 12px" }}>
        {bodyText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
      <CtaButton href={ctaUrl} label={ctaLabel} />
    </EmailShell>
  );
}

import { Text } from "@react-email/components";

import { type EmailProductPick, CtaButton, EmailShell } from "~/emails/shell";

export function RefundRequestReceivedEmail({
  bodyText,
  ctaUrl,
  productPicks,
}: Readonly<{
  bodyText: string;
  ctaUrl: string;
  productPicks?: readonly EmailProductPick[];
}>) {
  return (
    <EmailShell
      picksSubtitle="Still shopping? You might like these"
      preview="Refund request received"
      productPicks={productPicks}
      showBrandStoryFooter
    >
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

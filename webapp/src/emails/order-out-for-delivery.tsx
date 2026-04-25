import { Text } from "@react-email/components";

import { CtaButton, type EmailProductPick, EmailShell } from "~/emails/shell";

export function OrderOutForDeliveryEmail({
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
      picksSubtitle="Treat yourself — new arrivals"
      preview="Your package is out for delivery"
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
      <CtaButton href={ctaUrl} label="View order & tracking" />
    </EmailShell>
  );
}

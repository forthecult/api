import { Text } from "@react-email/components";

import { CtaButton, type EmailProductPick, EmailShell } from "~/emails/shell";

export function EsimActivationEmail({
  bodyText,
  ctaLabel,
  ctaUrl,
  productPicks,
}: Readonly<{
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  productPicks?: readonly EmailProductPick[];
}>) {
  return (
    <EmailShell
      picksSubtitle="Popular picks while you set up"
      preview="Your eSIM is ready"
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
      <CtaButton href={ctaUrl} label={ctaLabel} />
    </EmailShell>
  );
}

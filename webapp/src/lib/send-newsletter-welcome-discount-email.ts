import { createElement } from "react";

import { NewsletterWelcomeDiscountEmail } from "~/emails/newsletter-welcome-discount";
import { sendEmail } from "~/lib/email/send-email";
import { buildUnsubscribeUrl } from "~/lib/email/unsubscribe-token";

export async function sendNewsletterWelcomeDiscountEmail(params: {
  discountCode: string;
  to: string;
}): Promise<void> {
  const subject = "You're on the list — here's your welcome code";
  const unsubscribeUrl = buildUnsubscribeUrl(params.to, "newsletter");

  await sendEmail({
    kind: "newsletter_welcome_discount",
    metadata: {
      campaign_id: "newsletter_welcome_discount",
      utm_campaign: "newsletter_welcome",
      utm_content: "welcome_discount",
    },
    react: createElement(NewsletterWelcomeDiscountEmail, {
      discountCode: params.discountCode,
      unsubscribeUrl,
    }),
    subject,
    to: params.to,
  });
}

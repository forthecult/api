import { createElement } from "react";

import { NewsletterConfirmEmail } from "~/emails/newsletter-confirm";
import { getPublicSiteUrl } from "~/lib/app-url";
import { sendEmail } from "~/lib/email/send-email";

export async function sendNewsletterConfirmEmail(params: {
  confirmationToken: string;
  to: string;
}): Promise<void> {
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const confirmUrl = `${base}/api/newsletter/confirm?token=${encodeURIComponent(params.confirmationToken)}`;
  const subject = "Confirm your newsletter subscription";

  await sendEmail({
    kind: "newsletter_confirm",
    react: createElement(NewsletterConfirmEmail, { confirmUrl }),
    subject,
    to: params.to,
  });
}

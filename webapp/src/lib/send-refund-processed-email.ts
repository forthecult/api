import { createElement } from "react";

import { RefundProcessedEmail } from "~/emails/refund-processed";
import { getPublicSiteUrl } from "~/lib/app-url";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export async function sendRefundProcessedEmail(params: {
  orderId: string;
  to: string;
}): Promise<void> {
  const { orderId, to } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("refund");
  const subject = template.emailSubject ?? "Refund processed";
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const ordersUrl = `${baseUrl}/dashboard/orders`;
  let body =
    template.emailBody ??
    "Your refund has been processed. It may take a few business days to appear on your statement.";
  body += `\n\nOrder ID: ${shortId}`;

  try {
    await sendEmail({
      correlationId: orderId,
      kind: "refund",
      react: createElement(RefundProcessedEmail, {
        bodyText: body,
        ctaUrl: ordersUrl,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendRefundProcessedEmail] send failed:", err);
  }
}

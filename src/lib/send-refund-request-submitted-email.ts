/**
 * Sends the "refund request received" transactional email.
 * Caller should check userWantsTransactionalEmail.
 */

import { createElement } from "react";

import { RefundRequestReceivedEmail } from "~/emails/refund-request-received";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export interface SendRefundRequestSubmittedEmailParams {
  orderId: string;
  to: string;
}

export async function sendRefundRequestSubmittedEmail(
  params: SendRefundRequestSubmittedEmailParams,
): Promise<void> {
  const { orderId, to } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("refund_request_submitted");
  const subject = template.emailSubject ?? "Refund request received";
  const baseUrl = getPublicSiteUrl();
  const refundPageUrl = `${baseUrl.replace(/\/$/, "")}/refund`;
  let body =
    template.emailBody ??
    "We've received your refund request. We'll process it and notify you when it's complete.";
  body += `\n\nOrder ID: ${shortId}`;
  body += `\n\nTrack or submit another request: ${refundPageUrl}`;

  const picks = await fetchRecommendedProductsForEmail({
    limit: 4,
    orderId,
  });

  try {
    await sendEmail({
      correlationId: `${orderId}-refund-request`,
      kind: "refund_request_submitted",
      react: createElement(RefundRequestReceivedEmail, {
        bodyText: body,
        ctaUrl: refundPageUrl,
        productPicks: picks,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendRefundRequestSubmittedEmail] send failed:", err);
  }

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log(
      "[sendRefundRequestSubmittedEmail] No RESEND_API_KEY - would send:",
      {
        body: body.slice(0, 200),
        subject,
        to,
      },
    );
  }
}

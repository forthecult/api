/**
 * Sends the "order shipped" transactional email.
 * Caller should check userWantsTransactionalEmail.
 */

import { createElement } from "react";

import { OrderShippedEmail } from "~/emails/order-shipped";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export interface SendOrderShippedEmailParams {
  orderId: string;
  to: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export async function sendOrderShippedEmail(
  params: SendOrderShippedEmailParams,
): Promise<void> {
  const { orderId, to, trackingNumber, trackingUrl } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("order_shipped");
  const subject = template.emailSubject ?? "Your order has shipped";
  const baseUrl = getPublicSiteUrl();
  const orderStatusUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/orders/${orderId}`;
  let body =
    template.emailBody ??
    "Your order has shipped. You can track it using the tracking link in this email.";
  if (trackingNumber) {
    body += `\n\nTracking number: ${trackingNumber}`;
  }
  if (trackingUrl) {
    body += `\nTrack your package: ${trackingUrl}`;
  }
  body += `\n\nOrder ID: ${shortId}`;
  body +=
    "\n\nWhen it arrives: try it on, then tell us how it fits — a one-line note or photo helps the next person choose with confidence.";

  const browseWithUtm = `${baseUrl.replace(/\/$/, "")}/products?utm_source=email&utm_medium=transactional&utm_campaign=order_shipped`;

  const picks = await fetchRecommendedProductsForEmail({
    limit: 4,
    orderId,
  });

  try {
    await sendEmail({
      correlationId: orderId,
      kind: "order_shipped",
      react: createElement(OrderShippedEmail, {
        bodyText: body,
        ctaUrl: orderStatusUrl,
        productPicks: picks,
        secondaryCtaHref: browseWithUtm,
        secondaryCtaLabel: "Complete the look",
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendOrderShippedEmail] send failed:", err);
  }

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[sendOrderShippedEmail] No RESEND_API_KEY - would send:", {
      body: body.slice(0, 200),
      subject,
      to,
    });
  }
}

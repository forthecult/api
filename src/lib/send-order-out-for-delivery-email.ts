/**
 * Transactional email when carrier marks package out for delivery (in transit).
 */

import { createElement } from "react";

import { OrderOutForDeliveryEmail } from "~/emails/order-out-for-delivery";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export async function sendOrderOutForDeliveryEmail(params: {
  orderId: string;
  to: string;
  trackingNumber?: string;
  trackingUrl?: string;
}): Promise<void> {
  const { orderId, to, trackingNumber, trackingUrl } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("order_out_for_delivery");
  const subject = template.emailSubject ?? "Your order is out for delivery";
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const orderUrl = `${baseUrl}/dashboard/orders/${orderId}`;

  let body =
    template.emailBody ??
    "Your package is out for delivery with the carrier. You can track the final leg below.";
  if (trackingNumber) {
    body += `\n\nTracking number: ${trackingNumber}`;
  }
  if (trackingUrl) {
    body += `\nTrack your package: ${trackingUrl}`;
  }
  body += `\n\nOrder ID: ${shortId}`;

  const picks = await fetchRecommendedProductsForEmail({
    orderId,
    limit: 4,
  });

  try {
    await sendEmail({
      correlationId: `${orderId}-out-for-delivery`,
      kind: "order_out_for_delivery",
      react: createElement(OrderOutForDeliveryEmail, {
        bodyText: body,
        ctaUrl: orderUrl,
        productPicks: picks,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendOrderOutForDeliveryEmail] send failed:", err);
  }
}

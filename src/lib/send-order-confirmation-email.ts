/**
 * Sends the "order confirmed" transactional email (when order is marked paid).
 * Caller should check userWantsTransactionalEmail.
 */

import { createElement } from "react";

import { OrderPlacedEmail } from "~/emails/order-placed";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export interface SendOrderConfirmationEmailParams {
  /** When true, body and CTA direct to eSIM dashboard to activate eSIM. */
  isEsimOrder?: boolean;
  orderId: string;
  to: string;
}

export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationEmailParams,
): Promise<void> {
  const { isEsimOrder, orderId, to } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("order_placed");
  const subject = template.emailSubject ?? "Order confirmed";
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");

  let body: string;
  let ctaLabel: string;
  let ctaUrl: string;

  if (isEsimOrder) {
    body =
      "Thank you for your order. Check your eSIM Dashboard to activate your eSIM.";
    ctaLabel = "eSIM Dashboard";
    ctaUrl = `${baseUrl}/dashboard/esim`;
  } else {
    body =
      template.emailBody ??
      "Thanks for your order. We'll send another email when it ships.";
    ctaLabel = "View order";
    ctaUrl = `${baseUrl}/dashboard/orders/${orderId}`;
  }
  body += `\n\nOrder ID: ${shortId}`;

  const picks = await fetchRecommendedProductsForEmail({
    orderId,
    limit: 4,
  });

  try {
    await sendEmail({
      correlationId: orderId,
      kind: "order_placed",
      react: createElement(OrderPlacedEmail, {
        bodyText: body,
        ctaLabel,
        ctaUrl,
        productPicks: picks,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendOrderConfirmationEmail] send failed:", err);
  }

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[sendOrderConfirmationEmail] No RESEND_API_KEY - would send:", {
      body: body.slice(0, 200),
      subject,
      to,
    });
  }
}

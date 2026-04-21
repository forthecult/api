/**
 * Sends the "order confirmed" transactional email (when order is marked paid).
 * Uses Resend when RESEND_API_KEY is set. Caller should check userWantsTransactionalEmail.
 * Uses shared email layout (header, footer, CTA) from ~/lib/email-layout.
 */

import { getPublicSiteUrl } from "~/lib/app-url";
import { buildEmailHtml, plainTextToHtml } from "~/lib/email-layout";
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

  const contentHtml = plainTextToHtml(body);
  const html = buildEmailHtml(contentHtml, {
    ctaLabel,
    ctaUrl,
  });

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        typeof process.env.RESEND_FROM_EMAIL === "string" &&
        process.env.RESEND_FROM_EMAIL.length > 0
          ? process.env.RESEND_FROM_EMAIL
          : "onboarding@resend.dev";
      await resend.emails.send({
        from,
        html,
        subject,
        text: `${body}\n\n${ctaLabel}: ${ctaUrl}`,
        to,
      });
    } catch (err) {
      console.error("[sendOrderConfirmationEmail] Resend send failed:", err);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[sendOrderConfirmationEmail] No RESEND_API_KEY - would send:",
      {
        body: body.slice(0, 200),
        subject,
        to,
      },
    );
  }
}

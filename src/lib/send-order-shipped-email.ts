/**
 * Sends the "order shipped" transactional email.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs in development.
 */

import { getPublicSiteUrl } from "~/lib/app-url";
import { getNotificationTemplate } from "~/lib/notification-templates";

export interface SendOrderShippedEmailParams {
  to: string;
  orderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/**
 * Send order shipped email. Respects transactional email preference (caller must check).
 */
export async function sendOrderShippedEmail(
  params: SendOrderShippedEmailParams,
): Promise<void> {
  const { to, orderId, trackingNumber, trackingUrl } = params;
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
  body += `\n\nView order status: ${orderStatusUrl}`;
  body += `\nOrder ID: ${shortId}`;

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
        to,
        subject,
        text: body,
        html: `<!DOCTYPE html><html><body><p>${body.replace(/\n/g, "<br/>")}</p></body></html>`,
      });
    } catch (err) {
      console.error("[sendOrderShippedEmail] Resend send failed:", err);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[sendOrderShippedEmail] No RESEND_API_KEY - would send:", {
      to,
      subject,
      body: body.slice(0, 200),
    });
  }
}

/**
 * Sends the "order confirmed" transactional email (when order is marked paid).
 * Uses Resend when RESEND_API_KEY is set. Caller should check userWantsTransactionalEmail.
 */

import { getNotificationTemplate } from "~/lib/notification-templates";

export interface SendOrderConfirmationEmailParams {
  to: string;
  orderId: string;
}

export async function sendOrderConfirmationEmail(
  params: SendOrderConfirmationEmailParams,
): Promise<void> {
  const { to, orderId } = params;
  const shortId = orderId.slice(0, 8);
  const template = getNotificationTemplate("order_placed");
  const subject = template.emailSubject ?? "Order confirmed";
  const baseUrl =
    (typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
      process.env.NEXT_PUBLIC_APP_URL.trim()) ||
    (typeof process.env.NEXT_SERVER_APP_URL === "string" &&
      process.env.NEXT_SERVER_APP_URL.trim()) ||
    "https://example.com";
  const orderStatusUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/orders/${orderId}`;
  let body =
    template.emailBody ??
    "Thanks for your order. We'll send another email when it ships.";
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
      console.error("[sendOrderConfirmationEmail] Resend send failed:", err);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[sendOrderConfirmationEmail] No RESEND_API_KEY - would send:", {
      to,
      subject,
      body: body.slice(0, 200),
    });
  }
}

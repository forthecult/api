/**
 * Sends the "refund request received" transactional email when a customer submits a refund request.
 * Uses Resend when RESEND_API_KEY is set. Caller should check userWantsTransactionalEmail.
 */

import { getPublicSiteUrl } from "~/lib/app-url";
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
        html: `<!DOCTYPE html><html><body><p>${body.replace(/\n/g, "<br/>")}</p></body></html>`,
        subject,
        text: body,
        to,
      });
    } catch (err) {
      console.error(
        "[sendRefundRequestSubmittedEmail] Resend send failed:",
        err,
      );
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
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

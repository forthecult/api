import { createElement } from "react";

import { SupportTicketReplyEmail } from "~/emails/support-ticket-reply";
import { getPublicSiteUrl } from "~/lib/app-url";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export async function sendSupportTicketReplyEmail(params: {
  messagePreview?: string;
  subject: string;
  ticketId: string;
  to: string;
}): Promise<void> {
  const { messagePreview, subject, ticketId, to } = params;
  const template = getNotificationTemplate("support_ticket_reply");
  const emailSubject =
    template.emailSubject ?? "New reply on your support ticket";
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const ticketUrl = `${baseUrl}/dashboard/support-tickets/${ticketId}`;
  let body =
    template.emailBody ??
    "Our support team has replied to your ticket. Open your dashboard to read the full message.";
  if (messagePreview) {
    body += `\n\nPreview: ${messagePreview}`;
  }

  try {
    await sendEmail({
      correlationId: ticketId,
      kind: "support_ticket_reply",
      react: createElement(SupportTicketReplyEmail, {
        bodyText: body,
        ctaUrl: ticketUrl,
        subjectLine: subject,
      }),
      subject: emailSubject,
      to,
    });
  } catch (err) {
    console.error("[sendSupportTicketReplyEmail] send failed:", err);
  }
}

/**
 * Transactional email for order_processing, order_on_hold, order_cancelled.
 */

import { createElement } from "react";

import type { OrderStatusKind } from "~/lib/create-user-notification";

import { OrderStatusEmail } from "~/emails/order-status";
import { getPublicSiteUrl } from "~/lib/app-url";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

export type OrderStatusEmailKind = Exclude<OrderStatusKind, "order_shipped">;

export async function sendOrderStatusEmail(params: {
  kind: OrderStatusEmailKind;
  orderId: string;
  to: string;
}): Promise<void> {
  const { kind, orderId, to } = params;
  const shortId = orderId.slice(0, 8);
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const ctaUrl = `${baseUrl}/dashboard/orders/${orderId}`;
  const template = getNotificationTemplate(kind);

  const subject = template.emailSubject ?? template.title;
  const preview =
    kind === "order_processing"
      ? "Your order is being made"
      : kind === "order_on_hold"
        ? "Order on hold"
        : "Order cancelled";
  const ctaLabel = "View order";

  let body =
    template.emailBody ??
    `${template.title} — order ${shortId}. See your dashboard for details.`;
  body += `\n\nOrder ID: ${shortId}`;

  try {
    await sendEmail({
      correlationId: orderId,
      kind,
      react: createElement(OrderStatusEmail, {
        bodyText: body,
        ctaLabel,
        ctaUrl,
        preview,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendOrderStatusEmail] send failed:", err);
  }
}

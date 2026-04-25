/**
 * Send a test email via the shared sendEmail path (React Email + logging).
 * Run: bun run scripts/send-test-email.ts your@email.com
 */

import "dotenv/config";

import { createElement } from "react";

import { OrderPlacedEmail } from "../src/emails/order-placed";
import { getPublicSiteUrl } from "../src/lib/app-url";
import { sendEmail } from "../src/lib/email/send-email";

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Usage: bun run scripts/send-test-email.ts your@email.com");
  process.exit(1);
}

async function main() {
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const orderStatusUrl = `${baseUrl}/dashboard/orders/test-order-123`;

  const body = [
    "Thanks for your order. We'll send another email when it ships.",
    "",
    "Order ID: test12345",
  ].join("\n");

  const result = await sendEmail({
    correlationId: "send-test-email",
    internal: true,
    kind: "order_placed",
    react: createElement(OrderPlacedEmail, {
      bodyText: body,
      ctaLabel: "View order",
      ctaUrl: orderStatusUrl,
    }),
    subject: "[Test] Order confirmed – email template preview",
    to,
  });

  if (!result.ok) {
    console.error("Send failed:", result);
    process.exit(1);
  }

  console.log("Test email sent to", to);
  console.log("Message / event id:", result.resendId, result.emailEventId);
}

main();

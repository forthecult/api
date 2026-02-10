/**
 * Send yourself a test email using the shared email layout (header, content, footer).
 * Uses RESEND_API_KEY and RESEND_FROM_EMAIL from .env.
 *
 * Run: bun run scripts/send-test-email.ts your@email.com
 * Or:  bun run scripts/send-test-email.ts
 *      (prompts for email if not provided)
 */

import "dotenv/config";

import { buildEmailHtml, plainTextToHtml } from "../src/lib/email-layout";
import { getPublicSiteUrl } from "../src/lib/app-url";

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Usage: bun run scripts/send-test-email.ts your@email.com");
  process.exit(1);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set in .env. Add it to send real emails.");
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

  const contentHtml = plainTextToHtml(body);
  const html = buildEmailHtml(contentHtml, {
    ctaUrl: orderStatusUrl,
    ctaLabel: "View order",
  });

  const from =
    typeof process.env.RESEND_FROM_EMAIL === "string" &&
    process.env.RESEND_FROM_EMAIL.length > 0
      ? process.env.RESEND_FROM_EMAIL
      : "onboarding@resend.dev";

  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "[Test] Order confirmed – email template preview",
    text: body + `\n\nView order status: ${orderStatusUrl}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }

  console.log("Test email sent to", to);
  console.log("Message ID:", data?.id ?? "(no id)");
}

main();

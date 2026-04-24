/**
 * Renders all marketing/transactional React Email templates to HTML and checks size.
 * Used in CI to catch render errors and Gmail clipping (> ~102KB).
 *
 * Run: bun run scripts/render-email-templates.ts
 */

import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";

import { AddEmailCodeEmail } from "../src/emails/add-email-code";
import { EsimActivationEmail } from "../src/emails/esim-activation";
import { NewsletterConfirmEmail } from "../src/emails/newsletter-confirm";
import { NewsletterWelcomeDiscountEmail } from "../src/emails/newsletter-welcome-discount";
import { OrderPlacedEmail } from "../src/emails/order-placed";
import { OrderShippedEmail } from "../src/emails/order-shipped";
import { OrderStatusEmail } from "../src/emails/order-status";
import { OtpEmail } from "../src/emails/otp";
import { PasswordResetEmail } from "../src/emails/password-reset";
import { RefundProcessedEmail } from "../src/emails/refund-processed";
import { RefundRequestReceivedEmail } from "../src/emails/refund-request-received";
import { StaffContactFormEmail } from "../src/emails/staff-contact-form";
import { StaffRefundAlertEmail } from "../src/emails/staff-refund-alert";
import { SupportTicketReplyEmail } from "../src/emails/support-ticket-reply";
import { WelcomeEmail } from "../src/emails/welcome";

const MAX_BYTES = 102_000;

const samples: Array<{ name: string; node: ReactElement }> = [
  {
    name: "order-placed",
    node: createElement(OrderPlacedEmail, {
      bodyText: "Test\n\nOrder ID: abc",
      ctaLabel: "View",
      ctaUrl: "https://example.com/o",
    }),
  },
  {
    name: "order-shipped",
    node: createElement(OrderShippedEmail, {
      bodyText: "Shipped\n\nTrack: https://t",
      ctaUrl: "https://example.com/o",
    }),
  },
  {
    name: "order-status",
    node: createElement(OrderStatusEmail, {
      bodyText: "Processing",
      ctaLabel: "View",
      ctaUrl: "https://example.com/o",
      preview: "Preview",
    }),
  },
  {
    name: "refund-request",
    node: createElement(RefundRequestReceivedEmail, {
      bodyText: "Received",
      ctaUrl: "https://example.com/refund",
    }),
  },
  {
    name: "refund-processed",
    node: createElement(RefundProcessedEmail, {
      bodyText: "Done",
      ctaUrl: "https://example.com/orders",
    }),
  },
  {
    name: "support-reply",
    node: createElement(SupportTicketReplyEmail, {
      bodyText: "Reply",
      ctaUrl: "https://example.com/t",
      subjectLine: "Help",
    }),
  },
  {
    name: "welcome",
    node: createElement(WelcomeEmail, {
      bodyText: "Welcome body",
      userName: "Alex",
    }),
  },
  {
    name: "otp",
    node: createElement(OtpEmail, {
      appName: "Culture",
      otp: "123456",
      purposeLine: "Use this code to sign in.",
    }),
  },
  {
    name: "password-reset",
    node: createElement(PasswordResetEmail, {
      resetUrl: "https://example.com/reset",
    }),
  },
  {
    name: "add-email",
    node: createElement(AddEmailCodeEmail, { appName: "Culture", code: "999888" }),
  },
  {
    name: "esim",
    node: createElement(EsimActivationEmail, {
      bodyText: "eSIM ready\n\nActivate: https://x",
      ctaLabel: "Open",
      ctaUrl: "https://example.com/esim",
    }),
  },
  {
    name: "newsletter-confirm",
    node: createElement(NewsletterConfirmEmail, {
      confirmUrl: "https://example.com/confirm?token=x",
    }),
  },
  {
    name: "newsletter-welcome",
    node: createElement(NewsletterWelcomeDiscountEmail, {
      discountCode: "WELCOME10",
      unsubscribeUrl: "https://example.com/api/email/unsubscribe?token=dummy",
    }),
  },
  {
    name: "staff-contact",
    node: createElement(StaffContactFormEmail, {
      htmlBody: "<p>Hello</p>",
    }),
  },
  {
    name: "staff-refund",
    node: createElement(StaffRefundAlertEmail, {
      htmlBody: "<p>Refund</p>",
    }),
  },
];

async function main() {
  for (const { name, node } of samples) {
    const html = await render(node, { pretty: false });
    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > MAX_BYTES) {
      console.error(`${name}: HTML too large (${bytes} bytes > ${MAX_BYTES})`);
      process.exit(1);
    }
    console.log(`${name}: ${bytes} bytes`);
  }
  console.log("All templates rendered OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

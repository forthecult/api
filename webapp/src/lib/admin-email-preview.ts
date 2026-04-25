import "server-only";
import { createElement, type ReactElement } from "react";

import { AddEmailCodeEmail } from "~/emails/add-email-code";
import { EsimActivationEmail } from "~/emails/esim-activation";
import { MarketingFunnelDripEmail } from "~/emails/marketing-funnel-drip";
import { NewsletterConfirmEmail } from "~/emails/newsletter-confirm";
import { NewsletterWelcomeDiscountEmail } from "~/emails/newsletter-welcome-discount";
import { OrderOutForDeliveryEmail } from "~/emails/order-out-for-delivery";
import { OrderPlacedEmail } from "~/emails/order-placed";
import { OrderShippedEmail } from "~/emails/order-shipped";
import { OrderStatusEmail } from "~/emails/order-status";
import { OtpEmail } from "~/emails/otp";
import { PasswordResetEmail } from "~/emails/password-reset";
import { RefundRequestReceivedEmail } from "~/emails/refund-request-received";
import { RefundProcessedEmail } from "~/emails/refund-processed";
import { StaffContactFormEmail } from "~/emails/staff-contact-form";
import { StaffRefundAlertEmail } from "~/emails/staff-refund-alert";
import { SupportTicketReplyEmail } from "~/emails/support-ticket-reply";
import type { EmailProductPick } from "~/emails/shell";
import { WelcomeEmail } from "~/emails/welcome";
import { getAdminPreviewableEmailKinds } from "~/lib/admin-email-catalog";
import { getPublicSiteUrl } from "~/lib/app-url";
import { db } from "~/db";
import { ordersTable, userTable } from "~/db/schema";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import type { EmailSendKind } from "~/lib/email/email-send-kind";
import { getNotificationTemplate } from "~/lib/notification-templates";
import { eq } from "drizzle-orm";

const PREVIEW_APP_NAME = "For the Culture";

export interface AdminEmailPreviewContext {
  orderId?: string;
  userId?: string;
}

export type AdminEmailPreviewResult =
  | { error: string }
  | { kind: EmailSendKind; react: ReactElement; subject: string };

function baseUrl(): string {
  return getPublicSiteUrl().replace(/\/$/, "");
}

function mockPicks(): EmailProductPick[] {
  const b = baseUrl();
  return [
    {
      href: `${b}/products`,
      imageUrl: `${b}/placeholder.svg`,
      name: "Preview product A",
      priceLabel: "$48",
    },
    {
      href: `${b}/products`,
      imageUrl: `${b}/placeholder.svg`,
      name: "Preview product B",
      priceLabel: "$36",
    },
  ];
}

async function picksFor(
  ctx: AdminEmailPreviewContext,
): Promise<readonly EmailProductPick[]> {
  const rows = await fetchRecommendedProductsForEmail({
    limit: 4,
    orderId: ctx.orderId,
    userId: ctx.userId ?? null,
  });
  return rows.length > 0 ? rows : mockPicks();
}

async function loadUserName(userId?: string): Promise<string> {
  if (!userId?.trim()) return "there";
  const [u] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId.trim()))
    .limit(1);
  return u?.name?.trim() || "there";
}

export async function buildAdminEmailPreview(
  kindRaw: string,
  ctx: AdminEmailPreviewContext,
): Promise<AdminEmailPreviewResult> {
  const allowed = getAdminPreviewableEmailKinds();
  if (!allowed.has(kindRaw)) {
    return { error: `Unsupported email kind: ${kindRaw}` };
  }
  const kind = kindRaw as EmailSendKind;
  const b = baseUrl();
  const picks = await picksFor(ctx);
  const shortOrder = ctx.orderId?.slice(0, 8) ?? "preview";
  const orderDash = ctx.orderId
    ? `${b}/dashboard/orders/${ctx.orderId}`
    : `${b}/dashboard/orders`;

  switch (kind) {
    case "welcome_email": {
      const t = getNotificationTemplate("welcome_email");
      const userName = await loadUserName(ctx.userId);
      return {
        kind,
        react: createElement(WelcomeEmail, {
          bodyText:
            t.emailBody ??
            "You're in. We're glad to have you. The shop's ready when you are.",
          productPicks: picks,
          userName,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Welcome"}`,
      };
    }
    case "welcome_series_2":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Thanks again for joining For the Culture. If you have not checked out yet, here is a quick snapshot of what shoppers pick up first.",
            "New drops land weekly across apparel, longevity, and culture-forward gear.",
          ],
          couponCode: undefined,
          headline: "Here is what is trending at Culture",
          preview: "Trending picks for you",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Browse the shop",
          productPicks: picks,
          utmCampaign: "welcome_funnel",
          utmContent: "welcome_series_2",
        }),
        subject: "[PREVIEW] Still exploring? Here is what is popular",
      };
    case "welcome_series_3":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "We appreciate you being here. When you are ready, use the perks below and come back anytime — membership unlocks deeper discounts and early access.",
            "Your member dashboard has personalized recommendations as you shop more.",
          ],
          couponCode: undefined,
          headline: "A thank-you from Culture",
          preview: "A thank-you from Culture",
          primaryCtaHref: `${b}/membership`,
          primaryCtaLabel: "Explore membership",
          productPicks: picks,
          utmCampaign: "welcome_funnel",
          utmContent: "welcome_series_3",
        }),
        subject: "[PREVIEW] Thanks for being part of Culture",
      };
    case "abandon_cart_series": {
      const t = getNotificationTemplate("abandon_cart_series");
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            t.emailBody ??
              "You left something behind. Your picks are still waiting — checkout takes under a minute.",
          ],
          couponCode: undefined,
          headline: t.title,
          preview: t.emailSubject ?? "Your cart is waiting",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Return to shop",
          productPicks: picks,
          utmCampaign: "abandon_cart_funnel",
          utmContent: "abandon_cart_1",
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Cart reminder"}`,
      };
    }
    case "abandon_cart_series_2":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Still thinking it over? Inventory moves fast on limited runs — grab your size while it is here.",
          ],
          couponCode: undefined,
          headline: "Your cart is still saved",
          preview: "Your cart is still saved",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Finish checkout",
          productPicks: picks,
          utmCampaign: "abandon_cart_funnel",
          utmContent: "abandon_cart_2",
        }),
        subject: "[PREVIEW] Still interested? Your cart is open",
      };
    case "abandon_cart_series_3":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Last nudge from us — if you complete your order soon, you will lock in today’s pricing and fulfillment queue.",
          ],
          couponCode: undefined,
          headline: "One more reason to check out",
          preview: "One more reason to check out",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Complete purchase",
          productPicks: picks,
          utmCampaign: "abandon_cart_funnel",
          utmContent: "abandon_cart_3",
        }),
        subject: "[PREVIEW] We would love to see you back",
      };
    case "order_review_request": {
      const t = getNotificationTemplate("order_review_request");
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            t.emailBody ??
              "Your order was delivered. If everything looks good, a quick star rating helps the next shopper choose with confidence.",
          ],
          couponCode: undefined,
          headline: t.title,
          preview: t.emailSubject ?? "How was your order?",
          primaryCtaHref: ctx.orderId ? orderDash : `${b}/products`,
          primaryCtaLabel: ctx.orderId ? "Leave a review" : "View shop",
          productPicks: picks,
          utmCampaign: "review_funnel",
          utmContent: "order_review_1",
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "How was your order?"}`,
      };
    }
    case "order_review_series_2":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Reviews power small brands — if you have two minutes, share what fit, fabric, or delivery was like for you.",
          ],
          couponCode: undefined,
          headline: "Help the next shopper",
          preview: "Help the next shopper",
          primaryCtaHref: ctx.orderId ? orderDash : `${b}/products`,
          primaryCtaLabel: "Write a quick review",
          productPicks: picks,
          utmCampaign: "review_funnel",
          utmContent: "order_review_2",
        }),
        subject: "[PREVIEW] Quick favor — leave a review?",
      };
    case "order_review_series_3":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Whether you already reviewed or not — thank you. Here is a small perk for your next Culture order.",
          ],
          couponCode: undefined,
          headline: "Thanks for shopping with us",
          preview: "Thanks for shopping with us",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Shop again",
          productPicks: picks,
          utmCampaign: "review_funnel",
          utmContent: "order_review_3",
        }),
        subject: "[PREVIEW] Thanks again from Culture",
      };
    case "win_back_series": {
      const t = getNotificationTemplate("win_back_series");
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            t.emailBody ??
              "It has been a while since we shipped your last Culture order. New gear is in — here is what is moving fastest right now.",
          ],
          couponCode: undefined,
          headline: t.title,
          preview: t.emailSubject ?? "Here is what is new at Culture",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Shop new arrivals",
          productPicks: picks,
          utmCampaign: "win_back_funnel",
          utmContent: "win_back_1",
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Win-back"}`,
      };
    }
    case "win_back_series_2":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "Still on the fence? Members get early access and deeper discounts — and checkout stays fast whether you pay card or crypto.",
          ],
          couponCode: undefined,
          headline: "A quiet perk if you come back this week",
          preview: "A quiet perk if you come back this week",
          primaryCtaHref: `${b}/membership`,
          primaryCtaLabel: "See membership",
          productPicks: picks,
          utmCampaign: "win_back_funnel",
          utmContent: "win_back_2",
        }),
        subject: "[PREVIEW] Members are saving more on the same cart",
      };
    case "win_back_series_3":
      return {
        kind,
        react: createElement(MarketingFunnelDripEmail, {
          bodyLines: [
            "This is our last nudge for a while — if you are not ready, no worries. When you are, your next order still ships with the same care as always.",
          ],
          couponCode: undefined,
          headline: "We will be here",
          preview: "We will be here",
          primaryCtaHref: `${b}/products`,
          primaryCtaLabel: "Browse the shop",
          productPicks: picks,
          utmCampaign: "win_back_funnel",
          utmContent: "win_back_3",
        }),
        subject: "[PREVIEW] Whenever you are ready",
      };
    case "newsletter_welcome_discount":
      return {
        kind,
        react: createElement(NewsletterWelcomeDiscountEmail, {
          discountCode: "PREVIEW10",
          unsubscribeUrl: `${b}/newsletter/unsubscribe?preview=1`,
        }),
        subject: "[PREVIEW] Your welcome code",
      };
    case "order_placed": {
      const t = getNotificationTemplate("order_placed");
      const body =
        (t.emailBody ??
          "Thanks for your order. We'll send another email when it ships.") +
        `\n\nOrder ID: ${shortOrder}`;
      return {
        kind,
        react: createElement(OrderPlacedEmail, {
          bodyText: body,
          ctaLabel: "View order",
          ctaUrl: orderDash,
          productPicks: picks,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Order confirmed"}`,
      };
    }
    case "order_shipped": {
      const t = getNotificationTemplate("order_shipped");
      const body =
        (t.emailBody ??
          "Your order has shipped. You can track it using the tracking link in this email.") +
        `\n\nOrder ID: ${shortOrder}`;
      return {
        kind,
        react: createElement(OrderShippedEmail, {
          bodyText: body,
          ctaUrl: orderDash,
          productPicks: picks,
          secondaryCtaHref: `${b}/products?utm_source=email&utm_medium=transactional&utm_campaign=order_shipped`,
          secondaryCtaLabel: "Complete the look",
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Order shipped"}`,
      };
    }
    case "order_out_for_delivery": {
      const t = getNotificationTemplate("order_out_for_delivery");
      const body =
        t.emailBody ??
        "Great news — your package is out for delivery with the carrier.";
      return {
        kind,
        react: createElement(OrderOutForDeliveryEmail, {
          bodyText: `${body}\n\nOrder ID: ${shortOrder}`,
          ctaUrl: orderDash,
          productPicks: picks,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Out for delivery"}`,
      };
    }
    case "order_processing":
    case "order_on_hold":
    case "order_cancelled": {
      const t = getNotificationTemplate(kind);
      const preview =
        kind === "order_processing"
          ? "Your order is being made"
          : kind === "order_on_hold"
            ? "Order on hold"
            : "Order cancelled";
      return {
        kind,
        react: createElement(OrderStatusEmail, {
          bodyText: `${t.emailBody ?? t.body}\n\nOrder ID: ${shortOrder}`,
          ctaLabel: "View order",
          ctaUrl: orderDash,
          preview,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? t.title}`,
      };
    }
    case "refund": {
      const t = getNotificationTemplate("refund");
      return {
        kind,
        react: createElement(RefundProcessedEmail, {
          bodyText: `${t.emailBody ?? t.body}\n\nOrder ID: ${shortOrder}`,
          ctaUrl: orderDash,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Refund processed"}`,
      };
    }
    case "refund_request_submitted": {
      const t = getNotificationTemplate("refund_request_submitted");
      return {
        kind,
        react: createElement(RefundRequestReceivedEmail, {
          bodyText: `${t.emailBody ?? t.body}\n\nOrder ID: ${shortOrder}`,
          ctaUrl: orderDash,
          productPicks: picks,
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Refund request"}`,
      };
    }
    case "support_ticket_reply": {
      const t = getNotificationTemplate("support_ticket_reply");
      return {
        kind,
        react: createElement(SupportTicketReplyEmail, {
          bodyText:
            t.emailBody ??
            "Our support team has replied to your ticket. Log in to view the response.",
          ctaUrl: `${b}/dashboard/support`,
          subjectLine: "Order question — preview ticket",
        }),
        subject: `[PREVIEW] ${t.emailSubject ?? "Support reply"}`,
      };
    }
    case "password_reset":
      return {
        kind,
        react: createElement(PasswordResetEmail, {
          resetUrl: `${b}/auth/reset-password?preview=1&token=demo`,
        }),
        subject: "[PREVIEW] Reset your password",
      };
    case "otp":
      return {
        kind,
        react: createElement(OtpEmail, {
          appName: PREVIEW_APP_NAME,
          otp: "482910",
          purposeLine: "Use this code to finish signing in. This is a preview send from admin.",
        }),
        subject: "[PREVIEW] Your verification code",
      };
    case "add_email_verification":
      return {
        kind,
        react: createElement(AddEmailCodeEmail, {
          appName: PREVIEW_APP_NAME,
          code: "482910",
        }),
        subject: "[PREVIEW] Verify your email",
      };
    case "esim_activation":
      return {
        kind,
        react: createElement(EsimActivationEmail, {
          bodyText:
            "Your eSIM is ready. Open the dashboard to activate and install on your device.\n\nPreview order ref: " +
            shortOrder,
          ctaLabel: "eSIM Dashboard",
          ctaUrl: `${b}/dashboard/esim`,
          productPicks: picks,
        }),
        subject: "[PREVIEW] Activate your eSIM",
      };
    case "newsletter_confirm":
      return {
        kind,
        react: createElement(NewsletterConfirmEmail, {
          confirmUrl: `${b}/newsletter/confirm?preview=1`,
        }),
        subject: "[PREVIEW] Confirm your subscription",
      };
    case "internal_staff_contact":
      return {
        kind,
        react: createElement(StaffContactFormEmail, {
          htmlBody:
            "<p><strong>Preview</strong> — internal staff digest layout.</p><p>Name: Jane<br/>Email: jane@example.com<br/>Message: Question about order…</p>",
        }),
        subject: "[PREVIEW] Contact form (staff)",
      };
    case "internal_staff_refund_alert":
      return {
        kind,
        react: createElement(StaffRefundAlertEmail, {
          htmlBody:
            "<p><strong>Preview</strong> — refund alert digest.</p><p>Order: preview… · Amount: $42.00</p>",
        }),
        subject: "[PREVIEW] Refund alert (staff)",
      };
    default:
      return { error: `No preview builder for kind: ${kind}` };
  }
}

/** Validates `orderId` exists when provided (optional guard for admin UI). */
export async function adminPreviewOrderExists(
  orderId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId.trim()))
    .limit(1);
  return Boolean(row);
}

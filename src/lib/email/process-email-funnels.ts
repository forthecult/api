import "server-only";

import { createElement, type ReactElement } from "react";

import { and, eq, lte } from "drizzle-orm";

import { db } from "~/db";
import { emailFunnelEnrollmentTable } from "~/db/schema";
import { MarketingFunnelDripEmail } from "~/emails/marketing-funnel-drip";
import { getPublicSiteUrl } from "~/lib/app-url";
import type { EmailSendKind } from "~/lib/email/email-send-kind";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { resolveCouponCodeForFunnelStep } from "~/lib/email/funnel-coupon";
import type { EmailFunnelId } from "~/lib/email/funnel-enrollment";
import {
  getEmailFunnelContentVariant,
  getEmailFunnelCouponExperimentVariant,
} from "~/lib/email/posthog-email-experiments";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function distinctId(
  userId: null | string | undefined,
  email: string,
): string {
  return (userId && userId.trim()) || email;
}

async function sendFunnelMessage(options: {
  correlationId: string;
  email: string;
  kind: EmailSendKind;
  nextLastStep: number;
  nextSendAt: Date | null;
  rowId: string;
  subject: string;
  userId: null | string;
  react: ReactElement;
}): Promise<void> {
  const res = await sendEmail({
    correlationId: options.correlationId,
    kind: options.kind,
    react: options.react,
    subject: options.subject,
    to: options.email,
  });

  if ("skipped" in res && res.skipped) {
    await db
      .update(emailFunnelEnrollmentTable)
      .set({
        completed: true,
        nextSendAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailFunnelEnrollmentTable.id, options.rowId));
    return;
  }

  if (!("ok" in res) || res.ok !== true) {
    return;
  }

  await db
    .update(emailFunnelEnrollmentTable)
    .set({
      completed: options.nextSendAt == null,
      lastStepSent: options.nextLastStep,
      nextSendAt: options.nextSendAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailFunnelEnrollmentTable.id, options.rowId));
}

/** Process due rows (call from cron). */
export async function processDueEmailFunnels(): Promise<{ processed: number }> {
  const now = new Date();
  const rows = await db
    .select()
    .from(emailFunnelEnrollmentTable)
    .where(
      and(
        eq(emailFunnelEnrollmentTable.completed, false),
        lte(emailFunnelEnrollmentTable.nextSendAt, now),
      ),
    )
    .limit(40);

  let processed = 0;
  const base = getPublicSiteUrl().replace(/\/$/, "");

  for (const row of rows) {
    processed += 1;
    const funnel = row.funnel as EmailFunnelId;
    const distinct = distinctId(row.userId, row.email);
    const flagCtx = { email: row.email, userId: row.userId };
    const variant =
      row.experimentVariant?.trim() ||
      (await getEmailFunnelCouponExperimentVariant(distinct, flagCtx));
    const contentVariant = await getEmailFunnelContentVariant(
      distinct,
      flagCtx,
    );

    const orderId =
      typeof row.context?.orderId === "string" ? row.context.orderId : undefined;
    const cartProductIdsRaw = row.context?.cartProductIds;
    const cartProductIds = Array.isArray(cartProductIdsRaw)
      ? cartProductIdsRaw.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        )
      : undefined;

    const picks = await fetchRecommendedProductsForEmail({
      cartProductIds,
      orderId,
      userId: row.userId,
    });

    const nextStep = row.lastStepSent + 1;

    if (funnel === "welcome_3") {
      if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "welcome_3",
          step: 2,
        });
        const extra =
          contentVariant === "web3_forward" ?
            "Pay your way — card today, crypto at checkout when you want self-custody."
          : "New drops land weekly across apparel, longevity, and culture-forward gear.";
        await sendFunnelMessage({
          correlationId: `${row.id}-welcome-2`,
          email: row.email,
          kind: "welcome_series_2",
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 72 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "Thanks again for joining For the Culture. If you have not checked out yet, here is a quick snapshot of what shoppers pick up first.",
              extra,
            ],
            couponCode: coupon,
            headline: "Here is what is trending at Culture",
            preview: "Trending picks for you",
            primaryCtaHref: `${base}/shop`,
            primaryCtaLabel: "Browse the shop",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: "Still exploring? Here is what is popular",
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "welcome_3",
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-welcome-3`,
          email: row.email,
          kind: "welcome_series_3",
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "We appreciate you being here. When you are ready, use the perks below and come back anytime — membership unlocks deeper discounts and early access.",
              coupon ?
                "A small welcome gift is attached below — our way of saying thanks."
              : "Your member dashboard has personalized recommendations as you shop more.",
            ],
            couponCode: coupon,
            headline: "A thank-you from Culture",
            preview: "A thank-you from Culture",
            primaryCtaHref: `${base}/membership`,
            primaryCtaLabel: "Explore membership",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: coupon ? "A thank-you + something extra" : "Thanks for being part of Culture",
          userId: row.userId,
        });
      }
      continue;
    }

    if (funnel === "abandon_cart_3") {
      const t = getNotificationTemplate("abandon_cart_series");
      if (nextStep === 1) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 1,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-1`,
          email: row.email,
          kind: "abandon_cart_series",
          nextLastStep: 1,
          nextSendAt: new Date(Date.now() + 24 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              t.emailBody ??
                "You left something behind. Your picks are still waiting — checkout takes under a minute.",
            ],
            couponCode: coupon,
            headline: t.title,
            preview: t.emailSubject ?? "Your cart is waiting",
            primaryCtaHref: `${base}/shop`,
            primaryCtaLabel: "Return to shop",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: t.emailSubject ?? "You left something in your cart",
          userId: row.userId,
        });
      } else if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-2`,
          email: row.email,
          kind: "abandon_cart_series_2",
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 48 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "Still thinking it over? Inventory moves fast on limited runs — grab your size while it is here.",
            ],
            couponCode: coupon,
            headline: "Your cart is still saved",
            preview: "Your cart is still saved",
            primaryCtaHref: `${base}/shop`,
            primaryCtaLabel: "Finish checkout",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: "Still interested? Your cart is open",
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-3`,
          email: row.email,
          kind: "abandon_cart_series_3",
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "Last nudge from us — if you complete your order soon, you will lock in today’s pricing and fulfillment queue.",
            ],
            couponCode: coupon,
            headline: "One more reason to check out",
            preview: "One more reason to check out",
            primaryCtaHref: `${base}/shop`,
            primaryCtaLabel: "Complete purchase",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: coupon ? "A little extra to complete your order" : "We would love to see you back",
          userId: row.userId,
        });
      }
      continue;
    }

    if (funnel === "review_3") {
      const t = getNotificationTemplate("order_review_request");
      if (nextStep === 1) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 1,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-1`,
          email: row.email,
          kind: "order_review_request",
          nextLastStep: 1,
          nextSendAt: new Date(Date.now() + 4 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              t.emailBody ??
                "Your order was delivered. If everything looks good, a quick star rating helps the next shopper choose with confidence.",
            ],
            couponCode: coupon,
            headline: t.title,
            preview: t.emailSubject ?? "How was your order?",
            primaryCtaHref: orderId ? `${base}/dashboard/orders/${orderId}` : `${base}/shop`,
            primaryCtaLabel: orderId ? "Leave a review" : "View orders",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: t.emailSubject ?? "How was your order?",
          userId: row.userId,
        });
      } else if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-2`,
          email: row.email,
          kind: "order_review_series_2",
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 5 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "Reviews power small brands — if you have two minutes, share what fit, fabric, or delivery was like for you.",
            ],
            couponCode: coupon,
            headline: "Help the next shopper",
            preview: "Help the next shopper",
            primaryCtaHref: orderId ? `${base}/dashboard/orders/${orderId}` : `${base}/shop`,
            primaryCtaLabel: "Write a quick review",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: "Quick favor — leave a review?",
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-3`,
          email: row.email,
          kind: "order_review_series_3",
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: [
              "Whether you already reviewed or not — thank you. Here is a small perk for your next Culture order.",
            ],
            couponCode: coupon,
            headline: "Thanks for shopping with us",
            preview: "Thanks for shopping with us",
            primaryCtaHref: `${base}/shop`,
            primaryCtaLabel: "Shop again",
            productPicks: picks,
          }),
          rowId: row.id,
          subject: coupon ? "A perk for your next order" : "Thanks again from Culture",
          userId: row.userId,
        });
      }
    }
  }

  return { processed };
}

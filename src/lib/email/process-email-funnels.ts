import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { createElement, type ReactElement } from "react";

import type { EmailSendKind } from "~/lib/email/email-send-kind";
import type { EmailFunnelId } from "~/lib/email/funnel-enrollment";

import { db } from "~/db";
import { emailFunnelEnrollmentTable } from "~/db/schema";
import { MarketingFunnelDripEmail } from "~/emails/marketing-funnel-drip";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { resolveCouponCodeForFunnelStep } from "~/lib/email/funnel-coupon";
import { getMarketingSeriesEmailPlan } from "~/lib/email/marketing-series-framework";
import {
  getEmailFunnelContentVariant,
  getEmailFunnelCouponExperimentVariant,
} from "~/lib/email/posthog-email-experiments";
import { sendEmail } from "~/lib/email/send-email";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
      typeof row.context?.orderId === "string"
        ? row.context.orderId
        : undefined;
    const anchorOrderId =
      typeof row.context?.anchorOrderId === "string"
        ? row.context.anchorOrderId
        : undefined;
    const cartProductIdsRaw = row.context?.cartProductIds;
    const cartProductIds = Array.isArray(cartProductIdsRaw)
      ? cartProductIdsRaw.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        )
      : undefined;

    const picks = await fetchRecommendedProductsForEmail({
      cartProductIds,
      orderId: orderId ?? anchorOrderId,
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
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-welcome-2`,
          email: row.email,
          kind: "welcome_series_2",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 2,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 72 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
            videoLabel: plan.videoLabel,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "welcome_3",
          step: 3,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-welcome-3`,
          email: row.email,
          kind: "welcome_series_3",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 3,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      }
      continue;
    }

    if (funnel === "abandon_cart_3") {
      if (nextStep === 1) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 1,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 1,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-1`,
          email: row.email,
          kind: "abandon_cart_series",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 1,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 1,
          nextSendAt: new Date(Date.now() + 24 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 2,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-2`,
          email: row.email,
          kind: "abandon_cart_series_2",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 2,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 48 * HOUR_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "abandon_cart_3",
          step: 3,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-abandon-3`,
          email: row.email,
          kind: "abandon_cart_series_3",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 3,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      }
      continue;
    }

    if (funnel === "review_3") {
      if (nextStep === 1) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 1,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          orderId,
          step: 1,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-1`,
          email: row.email,
          kind: "order_review_request",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 1,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 1,
          nextSendAt: new Date(Date.now() + 4 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 2,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          orderId,
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-2`,
          email: row.email,
          kind: "order_review_series_2",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 2,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 5 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "review_3",
          step: 3,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          orderId,
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-review-3`,
          email: row.email,
          kind: "order_review_series_3",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 3,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      }
      continue;
    }

    if (funnel === "win_back_3") {
      if (nextStep === 1) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "win_back_3",
          step: 1,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 1,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-winback-1`,
          email: row.email,
          kind: "win_back_series",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 1,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 1,
          nextSendAt: new Date(Date.now() + 3 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 2) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "win_back_3",
          step: 2,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 2,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-winback-2`,
          email: row.email,
          kind: "win_back_series_2",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 2,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 2,
          nextSendAt: new Date(Date.now() + 5 * DAY_MS),
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      } else if (nextStep === 3) {
        const coupon = resolveCouponCodeForFunnelStep({
          experimentVariant: variant,
          funnel: "win_back_3",
          step: 3,
        });
        const plan = getMarketingSeriesEmailPlan({
          baseUrl: base,
          contentVariant,
          funnel,
          hasCoupon: Boolean(coupon),
          step: 3,
        });
        await sendFunnelMessage({
          correlationId: `${row.id}-winback-3`,
          email: row.email,
          kind: "win_back_series_3",
          metadata: {
            campaign_id: plan.campaignId,
            funnel,
            funnel_step: 3,
            utm_campaign: plan.utmCampaign,
            utm_content: plan.utmContent,
          },
          nextLastStep: 3,
          nextSendAt: null,
          react: createElement(MarketingFunnelDripEmail, {
            bodyLines: plan.bodyLines,
            couponCode: coupon,
            headline: plan.headline,
            picksSubtitle: plan.picksSubtitle,
            preview: plan.preview,
            primaryCtaHref: plan.primaryCtaHref,
            primaryCtaLabel: plan.primaryCtaLabel,
            productPicks: picks,
            utmCampaign: plan.utmCampaign,
            utmContent: plan.utmContent,
          }),
          rowId: row.id,
          subject: plan.subject,
          userId: row.userId,
        });
      }
      continue;
    }
  }

  return { processed };
}

function distinctId(userId: null | string | undefined, email: string): string {
  return userId?.trim() || email;
}

async function sendFunnelMessage(options: {
  correlationId: string;
  email: string;
  kind: EmailSendKind;
  metadata?: Record<string, unknown>;
  nextLastStep: number;
  nextSendAt: Date | null;
  react: ReactElement;
  rowId: string;
  subject: string;
  userId: null | string;
}): Promise<void> {
  const res = await sendEmail({
    correlationId: options.correlationId,
    kind: options.kind,
    metadata: options.metadata,
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

import { createElement } from "react";

import { WelcomeEmail } from "~/emails/welcome";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { enrollWelcomeMarketingSeries } from "~/lib/email/funnel-enrollment";
import { getEmailFunnelCouponExperimentVariant } from "~/lib/email/posthog-email-experiments";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";

/**
 * Sends the welcome email after a user signs up (marketing consent applies).
 * Schedules follow-up drip steps via `email_funnel_enrollment` + `/api/cron/email-funnels`.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  user: { email: string; id?: string; name?: null | string };
}): Promise<void> {
  const { to, user } = params;
  const template = getNotificationTemplate("welcome_email");
  const userName = user.name || "there";
  const subject = template.emailSubject || "Welcome!";
  const bodyText =
    template.emailBody ??
    "You're in. We're glad to have you. The shop's ready when you are.";

  const picks = await fetchRecommendedProductsForEmail({
    limit: 4,
    userId: user.id ?? null,
  });

  try {
    const res = await sendEmail({
      correlationId: user.id ? `welcome-${user.id}` : `welcome-${to}`,
      kind: "welcome_email",
      metadata: {
        campaign_id: "welcome_series_1",
        funnel: "welcome_3",
        funnel_step: 1,
        utm_campaign: "welcome_funnel",
        utm_content: "welcome_series_1",
      },
      react: createElement(WelcomeEmail, {
        bodyText,
        productPicks: picks,
        userName,
      }),
      subject,
      to,
    });

    if (res.ok === true) {
      const distinct = user.id?.trim() || to.trim().toLowerCase();
      const variant = await getEmailFunnelCouponExperimentVariant(distinct, {
        email: to,
        userId: user.id ?? null,
      });
      await enrollWelcomeMarketingSeries({
        email: to,
        experimentVariant: variant,
        userId: user.id ?? null,
      });
    }

    if (process.env.NODE_ENV === "development" && res.ok === true) {
      console.log("[sendWelcomeEmail] Welcome email sent to:", to);
    }
  } catch (err) {
    console.error("[sendWelcomeEmail] send failed:", err);
  }
}

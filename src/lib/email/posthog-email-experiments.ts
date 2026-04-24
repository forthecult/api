import "server-only";

import { getPostHogServer } from "~/lib/analytics/posthog-server";
import { buildEmailFunnelPersonPropertiesForPostHog } from "~/lib/email/email-experiment-person-properties";

export interface EmailFunnelFlagRecipientContext {
  email?: null | string;
  userId?: null | string;
}

/** Copy / framing A/B — PostHog flag `email_funnel_content_ab` (see coupon flag JSDoc for URLs). */
export async function getEmailFunnelContentVariant(
  distinctId: string,
  context?: EmailFunnelFlagRecipientContext,
): Promise<string> {
  const ph = getPostHogServer();
  if (!ph) return "default";
  try {
    const personProperties = await buildEmailFunnelPersonPropertiesForPostHog(
      context?.userId,
      context?.email ?? undefined,
    );
    const v = await ph.getFeatureFlag("email_funnel_content_ab", distinctId, {
      personProperties,
    });
    if (v === false || v === undefined || v === null) return "default";
    return String(v);
  } catch {
    return "default";
  }
}

/**
 * Multivariate flag for **when** to surface a coupon (welcome, abandon cart, review).
 * Pass `context` so PostHog evaluates `personProperties` from the server (`web3_linked`, `age_bucket`, …).
 *
 * PostHog: https://us.posthog.com/project/392171/feature_flags/654023 (`email_funnel_coupon_ab`) and
 * https://us.posthog.com/project/392171/feature_flags/654024 (`email_funnel_content_ab`).
 */
export async function getEmailFunnelCouponExperimentVariant(
  distinctId: string,
  context?: EmailFunnelFlagRecipientContext,
): Promise<string> {
  const ph = getPostHogServer();
  if (!ph) return "control";
  try {
    const personProperties = await buildEmailFunnelPersonPropertiesForPostHog(
      context?.userId,
      context?.email ?? undefined,
    );
    const v = await ph.getFeatureFlag("email_funnel_coupon_ab", distinctId, {
      personProperties,
    });
    if (v === false || v === undefined || v === null) return "control";
    return String(v);
  } catch {
    return "control";
  }
}

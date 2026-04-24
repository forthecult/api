import "server-only";

/**
 * Maps PostHog multivariate (`email_funnel_coupon_ab`) + funnel step to an optional checkout coupon code.
 * Set env vars per funnel so ops can rotate codes without deploy:
 * - EMAIL_FUNNEL_WELCOME_COUPON_CODE
 * - EMAIL_FUNNEL_ABANDON_COUPON_CODE
 * - EMAIL_FUNNEL_REVIEW_COUPON_CODE
 *
 * Example PostHog variants: `none`, `coupon_step_2`, `coupon_step_3`, `coupon_both`.
 */
export function resolveCouponCodeForFunnelStep(options: {
  experimentVariant: string;
  funnel: "abandon_cart_3" | "review_3" | "welcome_3";
  step: number;
}): string | undefined {
  const { experimentVariant, funnel, step } = options;
  const code =
    funnel === "welcome_3"
      ? process.env.EMAIL_FUNNEL_WELCOME_COUPON_CODE?.trim()
      : funnel === "abandon_cart_3"
        ? process.env.EMAIL_FUNNEL_ABANDON_COUPON_CODE?.trim()
        : process.env.EMAIL_FUNNEL_REVIEW_COUPON_CODE?.trim();
  if (!code) return undefined;

  const ev = experimentVariant.toLowerCase();
  if (ev === "none" || ev === "no_coupon") return undefined;

  const wants2 =
    ev.includes("step_2") ||
    ev.includes("coupon_2") ||
    ev === "coupon_both" ||
    ev === "coupon_early";
  const noLateCoupon = ev === "none" || ev === "no_coupon";

  if (
    step === 1 &&
    funnel === "abandon_cart_3" &&
    (ev.includes("coupon_1") || ev.includes("coupon_early") || ev === "coupon_both")
  ) {
    return code;
  }
  if (step === 2 && wants2) return code;
  if (step === 3 && !noLateCoupon) return code;
  return undefined;
}

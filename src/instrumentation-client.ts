/**
 * Runs once on the client BEFORE any other code (before React hydration, before
 * the layout's providers mount). Next.js 16 officially picks this file up at
 * `src/instrumentation-client.ts`.
 *
 * Why we init PostHog here instead of inside a React provider:
 *  - Events (pageviews, $exception, $autocapture) start being recorded from the
 *    very first frame, instead of racing with hydration. This fixes "missing
 *    first-landing pageview" for users who bounce within a second — a non-trivial
 *    chunk of mobile traffic and a conversion-funnel hole.
 *  - Error tracking (`capture_exceptions: true`) hooks window.onerror / unhandled
 *    rejection early, so crashes that happen in provider bootstrap code are also
 *    captured.
 *
 * The <AnalyticsProvider> in the app tree still wraps children in <PostHogProvider>
 * so components can use usePostHog(); it no-ops init when `inited` is already true.
 *
 * Privacy: we default to `identified_only` person profiles so anonymous visitors
 * don't produce billable profiles — signed-in / checkout users become identified
 * via posthog.identify() downstream.
 */

import posthog from "posthog-js";

import {
  PII_KEY_DENYLIST,
  redactProperties,
} from "~/lib/analytics/pii-redact";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
  "https://albertjaynock.forthecult.store";
const POSTHOG_UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() || "https://us.posthog.com";

if (POSTHOG_KEY && typeof window !== "undefined") {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Auto-capture JS errors + unhandled rejections with stack traces. Pairs
    // with the server-side `onRequestError` hook in instrumentation.ts for
    // end-to-end error visibility.
    capture_exceptions: true,
    // `defaults` opts us into PostHog's current best-practice bundle (automatic
    // pageleave capture, history_change pageview tracking for SPA routes, etc).
    // Pin to a dated value so behaviour is reproducible and doesn't silently
    // change under us when posthog-js ships a new default set.
    defaults: "2025-11-30",
    // Session recordings stay off at init. The identity bridge
    // (`src/lib/analytics/posthog-identity-bridge.tsx`) evaluates a gate
    // (see `session-replay-gate.ts`) once the user is identified and starts
    // recording only when the `session-replay-enabled` feature flag + any
    // explicit consent opt-in permit it. Anonymous visitors are never
    // recorded.
    disable_session_recording: true,
    persistence: "localStorage",
    // Only create billable profiles for users who have been identified
    // (post-login, checkout). Anonymous browsers still get events, but not
    // individual profiles. Big cost reducer at scale.
    person_profiles: "identified_only",
    // PII protection (SOC 2 CC6.7 / GDPR Art. 5(1)(c)):
    //  - `property_blacklist` drops these keys before they ever reach the
    //    PostHog queue.
    //  - `sanitize_properties` runs our shared redactor over what's left,
    //    scrubbing email/phone/CC/wallet strings that snuck into other keys
    //    (e.g. `page_title`, `referrer`, or custom event props).
    property_blacklist: [...PII_KEY_DENYLIST],
    sanitize_properties: (properties, _eventName) =>
      redactProperties(properties),
    ui_host: POSTHOG_UI_HOST,
  });
}

/**
 * Captures client-side route changes during Next.js App Router navigations.
 * Next.js 16 fires this hook whenever a `<Link>` navigation starts — we use it
 * to fire a synthetic pageview so SPA transitions show up in PostHog's web
 * analytics. (PostHog's `history_change` default also handles this, but
 * Next.js's typed hook is more reliable across soft-nav edge cases.)
 */
export const onRouterTransitionStart = (
  url: string,
  navigationType: string,
): void => {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  posthog.capture("$pageview", {
    $current_url: url,
    navigation_type: navigationType,
  });
};

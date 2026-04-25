"use client";

import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

const POSTHOG_ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

/**
 * Forwards Core Web Vitals (with attribution) to PostHog.
 *
 * Why attribution matters: `webVitalsAttribution` in next.config.ts enriches
 * each metric with the element/event that caused it (e.g. the specific <img>
 * that dragged LCP, or the button whose click produced a bad INP). Without
 * attribution all we'd know is "the number got worse"; with it we can jump
 * straight to the guilty component in PostHog.
 *
 * Mounted once in the root layout — it has zero DOM output.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!POSTHOG_ENABLED) return;
    // CLS / LCP / INP / FCP / TTFB all include `attribution` when the
    // webVitalsAttribution config lists them; forward the whole payload so
    // we don't lose information. `attribution` is present on the attribution
    // build of web-vitals that Next.js switches to automatically, but isn't
    // in the base Metric type — hence the narrow cast.
    const attribution = (metric as { attribution?: unknown }).attribution;
    posthog.capture("$web_vitals", {
      $web_vitals_attribution: attribution,
      $web_vitals_delta: metric.delta,
      $web_vitals_id: metric.id,
      $web_vitals_metric: metric.name,
      $web_vitals_navigation_type: metric.navigationType,
      $web_vitals_rating: metric.rating,
      $web_vitals_value: metric.value,
    });
  });
  return null;
}

"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

/**
 * Thin wrapper that exposes the shared PostHog client to the React tree via
 * `usePostHog()` / `usePostHogHook()`.
 *
 * Initialisation itself has moved to `src/instrumentation-client.ts` — that
 * file runs *before* React hydrates, which fixes three concrete issues:
 *   1. Previously the init ran inside a `useLayoutEffect` in this provider,
 *      so fast-bouncing visitors (back-button within ~300 ms) never produced
 *      a pageview. That's a silent hole in the conversion funnel.
 *   2. Client-side `$exception` capture needs to hook window.onerror before
 *      user code runs; a provider runs too late for that.
 *   3. Removing the effect here eliminates a render-blocking effect on every
 *      page, helping INP.
 *
 * When `NEXT_PUBLIC_POSTHOG_KEY` is unset (local/dev), instrumentation-client
 * never calls `posthog.init()` — passing the uninitialised client to
 * <PostHogProvider> is a safe no-op, so we just always render it.
 */
export function AnalyticsProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

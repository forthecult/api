"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useLayoutEffect, useRef } from "react";

/**
 * PostHog is open-source, self-hostable, and EU-friendly when `NEXT_PUBLIC_POSTHOG_HOST`
 * points at `https://eu.i.posthog.com` (or your own instance). No script loads unless
 * `NEXT_PUBLIC_POSTHOG_KEY` is set — zero third-party calls otherwise.
 *
 * @see https://posthog.com/docs/libraries/js
 */
export function AnalyticsProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
  const inited = useRef(false);

  useLayoutEffect(() => {
    if (!key || inited.current) return;
    posthog.init(key, {
      api_host: host,
      capture_pageleave: true,
      capture_pageview: true,
      disable_session_recording: true,
      persistence: "localStorage",
    });
    inited.current = true;
  }, [key, host]);

  if (!key) return <>{children}</>;

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

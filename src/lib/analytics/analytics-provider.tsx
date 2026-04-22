"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useLayoutEffect, useRef } from "react";

/** Default ingest host: Railway reverse proxy (see PostHog Railway proxy guide). */
const defaultPosthogApiHost = "https://albertjaynock.forthecult.store";

/**
 * PostHog runs only when `NEXT_PUBLIC_POSTHOG_KEY` is set. Events go to
 * `NEXT_PUBLIC_POSTHOG_HOST` (defaults to the Cult Railway proxy). With a proxy,
 * `ui_host` must stay on PostHog Cloud for toolbar / session links — set
 * `NEXT_PUBLIC_POSTHOG_UI_HOST` if your project is in the EU region.
 *
 * @see https://posthog.com/docs/libraries/js
 * @see https://posthog.com/docs/advanced/proxy/railway
 */
export function AnalyticsProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || defaultPosthogApiHost;
  const uiHost =
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() || "https://us.posthog.com";
  const inited = useRef(false);

  useLayoutEffect(() => {
    if (!key || inited.current) return;
    posthog.init(key, {
      api_host: host,
      capture_pageleave: true,
      capture_pageview: true,
      disable_session_recording: true,
      persistence: "localStorage",
      ui_host: uiHost,
    });
    inited.current = true;
  }, [key, host, uiHost]);

  if (!key) return <>{children}</>;

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

"use client";

import posthog from "posthog-js";
import * as React from "react";

import {
  getAttributionSuperProperties,
  mergeAttributionFromLocationSearch,
} from "~/lib/analytics/attribution-session";

function registerAttributionSuperProps(): void {
  if (!posthog.__loaded) return;
  const props = getAttributionSuperProperties();
  if (Object.keys(props).length === 0) return;
  try {
    posthog.register(props);
  } catch {
    // ignore
  }
}

/**
 * Merges URL attribution into sessionStorage and registers PostHog super-properties
 * (no new marketing cookies). Retries briefly until posthog-js finishes init.
 */
export function UtmCapture(): null {
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    mergeAttributionFromLocationSearch(window.location.search ?? "");
    registerAttributionSuperProps();
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      registerAttributionSuperProps();
      if (posthog.__loaded || attempts > 25) {
        window.clearInterval(id);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  return null;
}

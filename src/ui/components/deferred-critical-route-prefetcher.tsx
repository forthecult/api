"use client";

import type { ComponentType } from "react";

import { useEffect, useState } from "react";

import { whenIdle } from "~/lib/when-idle";

/**
 * Loads CriticalRoutePrefetcher after the main thread is idle so prefetch logic
 * doesn't compete with LCP. On mobile we use a longer timeout so the hero/LCP
 * content can paint before the prefetcher chunk loads.
 */
export function DeferredCriticalRoutePrefetcher() {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    const timeoutMs = isMobile ? 3500 : 2000;
    return whenIdle(() => {
      import("~/ui/components/critical-route-prefetcher").then((mod) => {
        setComponent(() => mod.CriticalRoutePrefetcher);
      });
    }, timeoutMs);
  }, []);

  if (!Component) return null;
  return <Component />;
}

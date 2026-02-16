"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";

function whenIdle(cb: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(cb, { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(cb, 0);
  return () => clearTimeout(t);
}

/**
 * Loads CriticalRoutePrefetcher after the main thread is idle so prefetch logic
 * doesn't compete with LCP. Prefetch still runs soon after load.
 */
export function DeferredCriticalRoutePrefetcher() {
  const [Component, setComponent] = useState<null | ComponentType>(null);

  useEffect(() => {
    return whenIdle(() => {
      import("~/ui/components/critical-route-prefetcher").then((mod) => {
        setComponent(() => mod.CriticalRoutePrefetcher);
      });
    }, 2000);
  }, []);

  if (!Component) return null;
  return <Component />;
}

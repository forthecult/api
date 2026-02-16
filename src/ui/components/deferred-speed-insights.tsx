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
 * Renders Vercel SpeedInsights only after the main thread is idle, so it doesn't
 * compete with LCP / critical JS. Only mounts when NEXT_PUBLIC_VERCEL=1.
 */
export function DeferredSpeedInsights() {
  const [Component, setComponent] = useState<null | ComponentType>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_VERCEL !== "1") return;

    return whenIdle(() => {
      import("@vercel/speed-insights/next").then((mod) => {
        setComponent(() => mod.SpeedInsights);
      });
    }, 3000);
  }, []);

  if (!Component) return null;
  return <Component />;
}

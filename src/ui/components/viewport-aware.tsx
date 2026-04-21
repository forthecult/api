"use client";

import * as React from "react";

const DEFAULT_ROOT_MARGIN = "0px 0px 20% 0px";
const DEFAULT_THRESHOLD = 0;

interface ViewportAwareProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Renders children only when the sentinel enters (or is near) the viewport.
 * Use to delay loading below-the-fold chunks until the user scrolls, reducing TBT.
 */
export function ViewportAware({
  children,
  fallback = null,
  rootMargin = DEFAULT_ROOT_MARGIN,
  threshold = DEFAULT_THRESHOLD,
}: ViewportAwareProps) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold]);

  if (!inView) {
    return (
      <div aria-hidden ref={sentinelRef} style={{ minHeight: 1 }}>
        {fallback}
      </div>
    );
  }
  return <>{children}</>;
}

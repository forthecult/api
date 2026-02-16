"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LazyFooter = dynamic(
  () => import("~/ui/components/footer").then((m) => ({ default: m.Footer })),
  { ssr: false },
);

/** Trigger when sentinel is within 40% of viewport from bottom (user ~60% down the page). */
const FOOTER_ROOT_MARGIN = "0px 0px 40% 0px";

/** Renders Footer only when user has scrolled near the bottom (~60% down).
 * Uses IntersectionObserver so footer JS doesn't run until needed. */
function FooterWhenNearBottom() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: FOOTER_ROOT_MARGIN, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!inView) {
    return <div ref={sentinelRef} aria-hidden style={{ minHeight: 1 }} />;
  }
  return <LazyFooter />;
}

/** Renders Footer everywhere except checkout, login, signup, and Telegram Mini App.
 * On allowed routes, footer loads only when user scrolls near the bottom (~60% down). */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/checkout")) return null;
  if (pathname?.startsWith("/telegram")) return null;
  if (pathname === "/login" || pathname === "/signup") return null;
  return <FooterWhenNearBottom />;
}

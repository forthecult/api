"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

/**
 * Rotating banner above the header. Cycles through promo messages.
 * On mobile, collapsible via chevron.
 */
const BANNER_MESSAGES = [
  "Hold 250k CULT → Free worldwide shipping",
  "No trackers. No data sales. Your privacy, protected.",
  "Shipping to 100+ countries",
];

const ROTATE_INTERVAL_MS = 6000;

export function TopBanner() {
  const [index, setIndex] = useState(0);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % BANNER_MESSAGES.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden border-b border-border bg-primary/90 text-sm font-medium text-primary-foreground md:py-2",
        mobileCollapsed ? "py-1.5" : "py-2",
      )}
      role="marquee"
      aria-live="polite"
      aria-atomic="true"
    >
      <button
        type="button"
        className="flex w-full flex-1 items-center justify-center gap-1.5 py-0 md:pointer-events-none md:gap-0"
        onClick={() => setMobileCollapsed((c) => !c)}
        aria-expanded={!mobileCollapsed}
        aria-label={mobileCollapsed ? "Expand announcement" : "Collapse announcement"}
      >
        <p
          key={index}
          className={cn(
            "flex-1 text-center",
            !mobileCollapsed && "animate-fade-in",
          )}
          suppressHydrationWarning
        >
          {BANNER_MESSAGES[index]}
        </p>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-80 transition-transform md:hidden",
            mobileCollapsed && "-rotate-90",
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}

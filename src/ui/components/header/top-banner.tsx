"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

/**
 * Rotating banner above the header. Cycles through promo messages.
 * On mobile, collapsible via chevron.
 */
const BANNER_MESSAGES = [
  "CULT Members → Free worldwide shipping",
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
      aria-atomic="true"
      aria-live="polite"
      className={cn(
        `
          relative flex w-full overflow-hidden border-b border-[#2A2A2A]
          bg-[#C4873A] text-sm font-medium tracking-[0.1em] text-[#111111]
          uppercase
          md:py-2
        `,
        mobileCollapsed ? "py-1.5" : "py-2",
      )}
      role="marquee"
    >
      <button
        aria-expanded={!mobileCollapsed}
        aria-label={
          mobileCollapsed ? "Expand announcement" : "Collapse announcement"
        }
        className={`
          flex w-full flex-1 items-center justify-center gap-1.5 py-0
          md:pointer-events-none md:gap-0
        `}
        onClick={() => setMobileCollapsed((c) => !c)}
        type="button"
      >
        <p
          className={cn(
            "flex-1 text-center",
            !mobileCollapsed && "animate-fade-in",
          )}
          key={index}
          suppressHydrationWarning
        >
          {BANNER_MESSAGES[index]}
        </p>
        <ChevronDown
          aria-hidden
          className={cn(
            `
              h-4 w-4 shrink-0 opacity-80 transition-transform
              md:hidden
            `,
            mobileCollapsed && "-rotate-90",
          )}
        />
      </button>
    </div>
  );
}

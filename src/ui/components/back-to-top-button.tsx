"use client";

import { ChevronUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

const SCROLL_THRESHOLD_PX = 320;

export function BackToTopButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const allowed = isStorePageWithFooter(pathname);

  useEffect(() => {
    if (!allowed) return;
    const onScroll = () => {
      const next = window.scrollY > SCROLL_THRESHOLD_PX;
      setVisible((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [allowed]);

  if (!allowed) return null;

  return (
    <button
      aria-label="Back to top"
      className={cn(
        `
          group fixed right-6 bottom-40 z-40 transition-opacity
          duration-200
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-ring
          sm:bottom-44
        `,
        visible
          ? `pointer-events-auto opacity-100`
          : `pointer-events-none opacity-0`,
      )}
      onClick={() => {
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ behavior: reduce ? "auto" : "smooth", top: 0 });
      }}
      type="button"
    >
      <span
        className={cn(
          `
            flex size-9 items-center justify-center rounded-sm border border-border
            bg-background text-foreground shadow-md ring-1 ring-black/5
            transition-colors
            hover:bg-muted
            dark:border-white/18 dark:bg-[#0D0D0D] dark:text-foreground dark:ring-white/10
            dark:hover:bg-[#141414]
          `,
        )}
      >
        <ChevronUp aria-hidden className="size-5" strokeWidth={2} />
      </span>
      <span
        className={`
          pointer-events-none absolute top-full left-1/2 z-10 mt-1.5
          -translate-x-1/2 rounded border border-border bg-background px-2
          py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap
          text-foreground uppercase opacity-0 shadow-sm transition-opacity
          duration-150
          group-hover:opacity-100
          group-focus-visible:opacity-100
          dark:border-white/25 dark:bg-[#0D0D0D]/95 dark:text-white
        `}
      >
        Back to top
      </span>
    </button>
  );
}

function isStorePageWithFooter(pathname: null | string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/checkout")) return false;
  if (pathname.startsWith("/telegram")) return false;
  if (pathname === "/login" || pathname === "/signup") return false;
  if (pathname === "/chat") return false;
  return true;
}

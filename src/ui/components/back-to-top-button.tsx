"use client";

import { ChevronUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

const SCROLL_THRESHOLD_PX = 320;

function isStorePageWithFooter(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/checkout")) return false;
  if (pathname.startsWith("/telegram")) return false;
  if (pathname === "/login" || pathname === "/signup") return false;
  if (pathname === "/chat") return false;
  return true;
}

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
      type="button"
      aria-label="Back to top"
      className={cn(
        `
          group relative fixed bottom-40 right-6 z-40 transition-opacity duration-200
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-ring
          sm:bottom-44
        `,
        visible ? `pointer-events-auto opacity-100` : `pointer-events-none opacity-0`,
      )}
      onClick={() => {
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <span
        className={cn(
          `
            flex size-9 items-center justify-center rounded-sm border
            shadow-sm transition-colors
            border-border/50 bg-muted/45 text-muted-foreground/70
            hover:bg-muted/70 hover:text-muted-foreground
            dark:border-white/18 dark:bg-[#0D0D0D] dark:text-foreground
            dark:hover:bg-[#141414]
          `,
        )}
      >
        <ChevronUp aria-hidden className="size-5" strokeWidth={2} />
      </span>
      <span
        className={`
          pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2
          whitespace-nowrap rounded border border-border/60 bg-background/95 px-2 py-0.5
          text-[10px] font-semibold uppercase tracking-wide text-foreground opacity-0
          shadow-sm transition-opacity duration-150
          group-hover:opacity-100 group-focus-visible:opacity-100
          dark:border-white/25 dark:bg-[#0D0D0D]/95 dark:text-white
        `}
      >
        Back to top
      </span>
    </button>
  );
}

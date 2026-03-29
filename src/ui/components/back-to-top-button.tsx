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
          fixed bottom-24 right-6 z-40 flex flex-col items-center gap-1
          transition-opacity duration-200
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-ring
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
        className={`
          flex size-9 items-center justify-center rounded-sm border
          border-white/25 bg-[#0a1628] text-white shadow-sm
          dark:border-white/20 dark:bg-[#0D0D0D]
        `}
      >
        <ChevronUp aria-hidden className="size-5" strokeWidth={2} />
      </span>
      <span
        className={`
          border border-white/35 bg-[#0a1628]/95 px-2 py-0.5 text-[10px] font-semibold
          uppercase tracking-wide text-white
          dark:border-white/25 dark:bg-[#0D0D0D]/95
        `}
      >
        Back to top
      </span>
    </button>
  );
}

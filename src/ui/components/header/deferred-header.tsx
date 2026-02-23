"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SEO_CONFIG } from "~/app";
import { cn } from "~/lib/cn";
import { whenIdle } from "~/lib/when-idle";

const LazyConditionalHeader = dynamic(
  () =>
    import("./conditional-header").then((m) => ({
      default: m.ConditionalHeader,
    })),
  {
    loading: () => <HeaderPlaceholder />,
    ssr: false,
  },
);

function isCryptoPayPage(pathname: null | string): boolean {
  if (pathname == null) return false;
  if (!pathname.startsWith("/checkout/")) return false;
  if (pathname === "/checkout/cancelled" || pathname === "/checkout/success")
    return false;
  return pathname.length > "/checkout/".length;
}

/** Minimal bar (same height as header) to avoid CLS while the real header chunk loads. */
function HeaderPlaceholder() {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-16 w-full border-b bg-background/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div
        className={cn(
          "container mx-auto flex h-16 max-w-7xl items-center px-4",
          "sm:px-6 lg:px-8",
        )}
      >
        <Link
          aria-label="Home"
          className="flex items-center gap-2"
          href="/"
        >
          {SEO_CONFIG.brandLogoUrl ? (
            <img
              alt=""
              className="h-8 w-auto"
              height={32}
              src={SEO_CONFIG.brandLogoUrl}
              width={32}
            />
          ) : (
            <span className="font-heading text-lg font-semibold tracking-wide">
              {SEO_CONFIG.name}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/**
 * Renders a minimal header placeholder until the main thread is idle, then
 * loads and shows the full ConditionalHeader (TopBanner + Header). Keeps the
 * header chunk out of the critical path so LCP (e.g. hero) can paint first.
 */
export function DeferredHeader(props: { showAuth?: boolean }) {
  const pathname = usePathname();
  const [loadHeader, setLoadHeader] = useState(false);

  useEffect(() => {
    return whenIdle(() => setLoadHeader(true), 100);
  }, []);

  if (isCryptoPayPage(pathname)) return null;
  if (pathname?.startsWith("/telegram")) return null;

  if (!loadHeader) return <HeaderPlaceholder />;
  return <LazyConditionalHeader {...props} />;
}

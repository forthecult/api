"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "~/lib/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
  subcategories?: Array<{
    id: string;
    name: string;
    slug?: string;
    productCount?: number;
  }>;
};

/** Column order: Currency, Network, Application. categories must be in that order (1–3 items). */
const COLUMN_LABELS = ["Currency", "Network", "Application"] as const;

const HOVER_OPEN_DELAY_MS = 120;
const HOVER_CLOSE_DELAY_MS = 150;

export function ShopByCryptoMenu({
  categories,
  className,
}: {
  categories: CategoryItem[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current != null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const clearOpenTimeout = React.useCallback(() => {
    if (openTimeoutRef.current != null) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  }, []);

  const handleTriggerEnter = React.useCallback(() => {
    clearCloseTimeout();
    clearOpenTimeout();
    openTimeoutRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  }, [clearCloseTimeout, clearOpenTimeout]);

  const handleTriggerLeave = React.useCallback(() => {
    clearOpenTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearOpenTimeout]);

  const handleContentEnter = React.useCallback(() => {
    clearCloseTimeout();
    clearOpenTimeout();
    setOpen(true);
  }, [clearCloseTimeout, clearOpenTimeout]);

  const handleContentLeave = React.useCallback(() => {
    clearOpenTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearOpenTimeout]);

  React.useEffect(() => {
    return () => {
      clearCloseTimeout();
      clearOpenTimeout();
    };
  }, [clearCloseTimeout, clearOpenTimeout]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary",
            "text-muted-foreground",
            className,
          )}
          aria-expanded={open}
          aria-haspopup="true"
          onMouseEnter={handleTriggerEnter}
          onMouseLeave={handleTriggerLeave}
        >
          Shop by Crypto
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[min(95vw,960px)] max-h-[min(80vh,520px)] overflow-auto rounded-xl border bg-popover p-0 shadow-lg"
        onMouseEnter={handleContentEnter}
        onMouseLeave={handleContentLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          className="grid gap-x-8 gap-y-4 py-4 px-4"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(160px, 1fr))`,
          }}
        >
          {categories.map((cat, index) => {
            const columnLabel = COLUMN_LABELS[index] ?? "Shop";
            const href = cat.slug ? `/${cat.slug}` : "/products";
            return (
              <div
                key={cat.id}
                className="flex min-w-[160px] flex-col shrink-0"
              >
                <span className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {columnLabel}
                </span>
                <Link
                  href={href}
                  className="rounded-lg px-3 py-2 text-base font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setOpen(false)}
                >
                  {cat.name}
                </Link>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-0">
                    {cat.subcategories.map((sub) => {
                      const subHref =
                        cat.slug && sub.slug
                          ? `/${cat.slug}?subcategory=${encodeURIComponent(sub.slug)}`
                          : href;
                      return (
                        <li key={sub.id}>
                          <Link
                            href={subHref}
                            className="block rounded px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            onClick={() => setOpen(false)}
                          >
                            {sub.name}
                            {sub.productCount != null && sub.productCount > 0 && (
                              <span className="ml-1 tabular-nums">
                                ({sub.productCount})
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

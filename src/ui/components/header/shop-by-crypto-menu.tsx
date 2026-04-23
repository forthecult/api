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

interface CategoryItem {
  id: string;
  name: string;
  productCount?: number;
  slug?: string;
  subcategories?: {
    id: string;
    name: string;
    productCount?: number;
    slug?: string;
  }[];
}

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
  const closeTimeoutRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );
  const openTimeoutRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );

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
    openTimeoutRef.current = setTimeout(
      () => setOpen(true),
      HOVER_OPEN_DELAY_MS,
    );
  }, [clearCloseTimeout, clearOpenTimeout]);

  const handleTriggerLeave = React.useCallback(() => {
    clearOpenTimeout();
    closeTimeoutRef.current = setTimeout(
      () => setOpen(false),
      HOVER_CLOSE_DELAY_MS,
    );
  }, [clearOpenTimeout]);

  const handleContentEnter = React.useCallback(() => {
    clearCloseTimeout();
    clearOpenTimeout();
    setOpen(true);
  }, [clearCloseTimeout, clearOpenTimeout]);

  const handleContentLeave = React.useCallback(() => {
    clearOpenTimeout();
    closeTimeoutRef.current = setTimeout(
      () => setOpen(false),
      HOVER_CLOSE_DELAY_MS,
    );
  }, [clearOpenTimeout]);

  React.useEffect(() => {
    return () => {
      clearCloseTimeout();
      clearOpenTimeout();
    };
  }, [clearCloseTimeout, clearOpenTimeout]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="true"
          className={cn(
            `
              accent-underline inline-flex items-center gap-1 rounded-md
              bg-transparent py-1.5 text-base font-medium tracking-wider
              transition-colors
              hover:text-[#C4873A]
            `,
            "text-[#8A857E]",
            className,
          )}
          onMouseEnter={handleTriggerEnter}
          onMouseLeave={handleTriggerLeave}
          type="button"
        >
          Shop by crypto
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`
          max-h-[min(80vh,520px)] w-[min(95vw,960px)] overflow-auto rounded-xl
          border bg-popover p-0
        `}
        onMouseEnter={handleContentEnter}
        onMouseLeave={handleContentLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        sideOffset={4}
      >
        <div
          className="grid gap-x-8 gap-y-4 px-4 py-4"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(160px, 1fr))`,
          }}
        >
        {categories.map((cat) => {
          const href = cat.slug ? `/${cat.slug}` : "/products";
          return (
            <div
              className="flex min-w-[160px] shrink-0 flex-col"
              key={cat.id}
            >
              <Link
                  className={`
                    rounded-lg px-3 py-2 text-base font-semibold
                    transition-colors
                    hover:bg-accent hover:text-accent-foreground
                  `}
                  href={href}
                  onClick={() => setOpen(false)}
                >
                  {cat.name}
                </Link>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 pl-0">
                    {cat.subcategories.map((sub) => {
                      const subHref = sub.slug ? `/${sub.slug}` : href;
                      return (
                        <li key={sub.id}>
                          <Link
                            className={`
                              block rounded px-3 py-1.5 text-sm
                              text-muted-foreground transition-colors
                              hover:bg-accent hover:text-foreground
                            `}
                            href={subHref}
                            onClick={() => setOpen(false)}
                          >
                            {sub.name}
                            {sub.productCount != null &&
                              sub.productCount > 0 && (
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
